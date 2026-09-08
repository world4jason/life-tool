"""Browser regression suite.

Default: real HTTP navigation/localStorage (start the bundled Node server).
TEST_MODE=document: render the standalone HTML with set_content and use an explicitly
labelled in-memory Storage test double. This supports navigation-restricted sandboxes;
it does not claim to test native storage persistence or file:// compatibility.

Prerequisite: pip install playwright; python -m playwright install chromium
"""
from __future__ import annotations
import json
import os
from pathlib import Path
import shutil
import subprocess
import time
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "test-results"
OUT.mkdir(exist_ok=True)
MODE = os.environ.get("TEST_MODE", "http")
PORT = int(os.environ.get("TEST_PORT", "4178"))
URL = f"http://127.0.0.1:{PORT}"
KEY = "life-atlas:v1"
HTML = (ROOT / "dist/life-atlas-offline.html").read_text()
results: list[dict] = []
errors: list[str] = []
external_requests: list[str] = []
server = None


def mark(name: str):
    results.append({"name": name, "passed": True})
    print(f"PASS {name}", flush=True)


def nav(page, stage: int):
    page.locator(f'.nav-item[data-page="{stage}"]').click()


def save(page):
    page.locator('#editor button[type="submit"]').click()
    try:
        expect(page.locator("#dialog")).not_to_be_visible(timeout=3000)
    except AssertionError:
        page.screenshot(path=str(OUT / "failed-form.png"), full_page=True)
        print("Form error:", page.locator("#form-error").inner_text())
        raise


def fill(page, name: str, value: str):
    page.locator(f'#editor [name="{name}"]').fill(value)


def choose(page, name: str, value: str):
    page.locator(f'#editor [name="{name}"]').select_option(value)


def stored(page):
    raw = page.evaluate("key => localStorage.getItem(key)", KEY)
    return json.loads(raw) if raw else None


def workspace(page):
    e = stored(page)
    return e["years"][str(e["activeYear"])]


def backup(page, filename="backup.json"):
    page.locator('.topbar [data-act="backup"]').click()
    with page.expect_download() as download:
        page.locator('[data-act="export-json"]').click()
    download.value.save_as(OUT / filename)
    page.locator('#dialog [data-act="close"]').click()
    return json.loads((OUT / filename).read_text())


def overflow(page):
    return page.evaluate("document.documentElement.scrollWidth > innerWidth + 1")


def create_page(browser, width=1440, height=1000, blocked=False, seed=None):
    ctx = browser.new_context(viewport={"width": width, "height": height},
                              is_mobile=width <= 600, has_touch=width <= 600,
                              device_scale_factor=1, reduced_motion="reduce")
    page = ctx.new_page()
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("request", lambda req: external_requests.append(req.url)
            if req.url.startswith(("http:", "https:")) and not req.url.startswith(URL) else None)
    if MODE == "document":
        page.evaluate("""seed => {
          window.__atlasStore = seed || {};
          Object.defineProperty(window, 'localStorage', {configurable: true, value: {
            getItem(k) { return Object.hasOwn(window.__atlasStore,k) ? window.__atlasStore[k] : null; },
            setItem(k,v) { window.__atlasStore[k] = String(v); },
            removeItem(k) { delete window.__atlasStore[k]; }
          }});
        }""", seed)
        if blocked:
            page.evaluate("Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new DOMException('Blocked for test','SecurityError')}})")
        page.set_content(HTML)
    else:
        if blocked:
            page.add_init_script("Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new DOMException('Blocked for test','SecurityError')}})")
        page.goto(URL)
    expect(page.locator("h1")).to_be_visible()
    return ctx, page


try:
    if MODE == "http":
        server = subprocess.Popen(["node", "scripts/serve.mjs"], cwd=ROOT,
                                  env={**os.environ, "PORT": str(PORT)},
                                  stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(0.5)
    with sync_playwright() as p:
        executable = os.environ.get("BROWSER_PATH") or (shutil.which("chromium") if MODE == "document" else None)
        browser = p.chromium.launch(**({"executable_path": executable} if executable else {}),
                                    args=["--no-sandbox"])
        ctx, page = create_page(browser)
        expect(page.locator(".warning")).to_have_count(0)
        page.screenshot(path=str(OUT / "desktop-home.png"), full_page=True)
        mark("home renders without JavaScript errors or network dependencies")

        nav(page, 1)
        for title in ["最初的舞蹈課", "和朋友散步", "一次很累的加班"]:
            page.locator('.page-heading [data-act="event"]').click()
            fill(page, "title", title)
            fill(page, "fact", "記錄可觀察的事情，不先替自己下結論。")
            save(page)
        assert len(workspace(page)["events"]) == 3
        expect(page.locator('.page-heading [data-act="event"]')).to_be_disabled()
        assert len({e["order"] for e in workspace(page)["events"]}) == 3
        mark("monthly cards save with a three-card limit and stable ordering")

        event_id = workspace(page)["events"][0]["id"]
        page.locator(f'[data-act="event"][data-id="{event_id}"]').click()
        choose(page, "month", "2")
        save(page)
        expect(page.locator('.page-heading [data-act="event"]')).to_be_enabled()
        page.locator('[data-act="background"]').click()
        fill(page, "title", "每天的通勤")
        save(page)
        assert len(workspace(page)["events"]) == 4
        assert workspace(page)["events"][-1]["background"]
        mark("moving between months frees a slot; daily background stays separate")

        nav(page, 2)
        page.locator(f'.event-card [data-act="reflect-event"][data-id="{event_id}"]').click()
        page.locator('[name="energy"]').evaluate("el=>{el.value='7';el.dispatchEvent(new Event('input',{bubbles:true}))}")
        page.locator('[name="emotions"][value="自在"]').check()
        choose(page, "planned", "unexpected")
        choose(page, "control", "together")
        fill(page, "meaning", "累，也很有意義。")
        save(page)
        page.locator("#basis").select_option("now")
        page.locator(f'.event-card [data-act="reflect-event"][data-id="{event_id}"]').click()
        page.locator('[name="energy"]').evaluate("el=>{el.value='-2';el.dispatchEvent(new Event('input',{bubbles:true}))}")
        save(page)
        current = next(e for e in workspace(page)["events"] if e["id"] == event_id)
        assert current["energy"] == 7 and current["energyNow"] == -2
        page.locator("#basis").select_option("then")
        assert page.locator('.energy-chart g[role="button"]').count() == 1
        mark("separate energy perspectives, emotions, planning, and agency persist")

        nav(page, 3)
        page.locator('.page-heading [data-act="theme"]').click()
        page.locator(f'[name="eventIds"][value="{event_id}"]').check()
        fill(page, "name", "找回自己的節奏")
        fill(page, "alternative", "也可能是有人陪伴，而不只是時間安排。")
        other_id = workspace(page)["events"][1]["id"]
        page.locator(f'[name="counterIds"][value="{other_id}"]').check()
        save(page)
        page.locator('[data-act="direction"]').click()
        fill(page, "name", "讓身體有表達的空間")
        fill(page, "why", "跳舞可以是享受，不必一直進步。")
        page.locator('[name="themeIds"]').first.check()
        save(page)
        assert workspace(page)["themes"][0]["counterIds"] == [other_id]
        assert len(workspace(page)["directions"][0]["themeIds"]) == 1
        mark("themes support evidence, counterexamples, alternatives and future directions")

        nav(page, 4)
        for title, kind, cost in [("多上一堂舞蹈課", "more", "1000"), ("少排一個晚上的會議", "less", "0"), ("先觀察兩週", "observe", "0")]:
            page.locator('.page-heading [data-act="route"]').click()
            fill(page, "title", title)
            choose(page, "kind", kind)
            fill(page, "benefit", "支持身體表達與自主安排。")
            fill(page, "tradeoff", "需要少安排另一件事。")
            fill(page, "firstStep", "週日安排一個練舞時段")
            fill(page, "hours", "2")
            fill(page, "money", cost)
            fill(page, "energy", "2")
            fill(page, "barrier", "工作時間延長")
            fill(page, "backup", "在家先跳一首歌")
            save(page)
        page.locator('[data-act="select-route"]').first.click()
        fill(page, "reason", "比較後，先試這條可負擔的路。")
        save(page)
        page.locator('[data-act="budget"]').click()
        fill(page, "hours", "2")
        fill(page, "money", "1000")
        fill(page, "energy", "2")
        save(page)
        expect(page.locator("main .warning")).to_have_count(0)
        page.locator('[data-change="stress"]').check()
        expect(page.locator("main .warning")).to_be_visible()
        page.locator('[data-change="stress"]').uncheck()
        expect(page.locator("main .warning")).to_have_count(0)
        assert len([r for r in workspace(page)["routes"] if r["selected"]]) == 1
        page.screenshot(path=str(OUT / "desktop-options-real-flow.png"), full_page=True)
        mark("Options compares three routes, selection rationale, budgets and stress limits")

        page.locator('[data-act="from-route"]').first.click()
        fill(page, "trigger", "週日打開行事曆，就選一個時段。")
        fill(page, "definition", "完整跳一首歌，記錄時間。")
        fill(page, "support", "做完記一句：更享受，還是更像作業？")
        fill(page, "objective", "讓跳舞回到生活")
        fill(page, "result", "至少一次感受到身體表達的自在")
        save(page)
        nav(page, 5)
        a = workspace(page)["actions"][0]
        assert a["routeId"] and len(a["directionIds"]) == 1
        assert a["trigger"] and a["definition"] and a["support"]
        assert a["backup"] == "在家先跳一首歌"
        mark("route-to-experiment carries references, measurable cadence and both acceptance checks")

        page.locator('.page-heading [data-act="action"]').click()
        fill(page, "title", "每週最多一次手搖飲")
        choose(page, "type", "boundary")
        fill(page, "target", "1")
        fill(page, "trigger", "點飲料之前，先看本週紀錄。")
        fill(page, "definition", "每週最多買一次，記錄實際杯數。")
        fill(page, "support", "是否支持我想要的生活，而不是增加自責？")
        save(page)
        assert workspace(page)["actions"][1]["type"] == "boundary"
        assert workspace(page)["actions"][1]["directionIds"] == []
        expect(page.locator(".metric").last).to_contain_text("最多 1")
        mark("bottom-up action and boundary upper limit work without forcing an OKR")

        nav(page, 6)
        page.locator(f'[data-act="review"][data-id="{a["id"]}"]').click()
        fill(page, "actual", "1")
        fill(page, "execution", "這兩週用縮小版本做了一次，沒有當作原版完成。")
        choose(page, "alignment", "mixed")
        fill(page, "learning", "形式比次數重要，下次先換時段。")
        choose(page, "decision", "pause")
        fill(page, "nextDate", "")
        save(page)
        assert len(workspace(page)["reviews"]) == 1
        assert workspace(page)["actions"][0]["status"] == "pause"
        assert workspace(page)["reviews"][0]["nextDate"] == ""
        mark("review logs execution versus meaning and allows pausing without a new deadline")

        with page.expect_download() as download:
            page.locator('[data-act="calendar"]').first.click()
        download.value.save_as(OUT / "review.ics")
        ics = (OUT / "review.ics").read_text()
        assert "BEGIN:VEVENT" in ics and "DTEND;VALUE=DATE:" in ics
        assert a["title"] not in ics and "週日" not in ics
        exported = backup(page)
        assert len(exported["actions"]) == 2 and len(exported["reviews"]) == 1
        mark("JSON backup round trip and privacy-minimised all-day calendar export")

        page.locator('.topbar [data-act="backup"]').click()
        with page.expect_download() as download:
            page.locator('[data-act="export-svg"]').click()
        download.value.save_as(OUT / "energy.svg")
        svg = (OUT / "energy.svg").read_text()
        assert "最初的舞蹈課" not in svg and "polyline" in svg
        unchanged = stored(page)
        page.locator("#import-file").set_input_files({"name": "bad.json", "mimeType": "application/json", "buffer": b'{oops'})
        expect(page.locator("#toast")).to_contain_text("無法讀取 JSON")
        assert stored(page) == unchanged
        bad_version = {**exported, "version": 99}
        page.locator("#import-file").set_input_files({"name": "future.json", "mimeType": "application/json", "buffer": json.dumps(bad_version).encode()})
        expect(page.locator("#toast")).to_contain_text("不支援")
        assert stored(page) == unchanged
        page.locator("#import-file").set_input_files(str(OUT / "backup.json"))
        expect(page.locator("#dialog-title")).to_contain_text("確認匯入")
        assert stored(page) == unchanged
        page.locator("#confirm-import").click()
        assert len(workspace(page)["reviews"]) == 1
        mark("SVG omits card text; invalid imports preserve data; valid imports require confirmation")

        nav(page, 1)
        private_id = workspace(page)["events"][1]["id"]
        private_month = workspace(page)["events"][1]["month"]
        page.locator(f'[data-act="month"][data-month="{private_month}"]').click()
        page.locator(f'[data-act="event"][data-id="{private_id}"]').click()
        fill(page, "title", "<img src=x onerror=alert(1)>")
        fill(page, "fact", "PRIVATE_TEST_FACT")
        page.locator('[name="private"]').check()
        save(page)
        assert page.locator("img").count() == 0
        expect(page.locator("main")).not_to_contain_text("PRIVATE_TEST_FACT")
        masked_export = backup(page, "masked-backup.json")
        assert any(e["private"] and e["fact"] == "PRIVATE_TEST_FACT" for e in masked_export["events"])
        page.locator('[data-act="privacy"]').click()
        expect(page.locator("main")).to_contain_text("內容已遮住")
        expect(page.locator(".event-card")).to_have_count(0)
        page.locator('.topbar [data-act="privacy"]').click()
        mark("private card text and global shield hide content; full backup remains explicitly unencrypted")

        formal = stored(page)
        nav(page, 0)
        page.locator('[data-act="demo"]').click()
        page.locator('.event-card [data-act="event"]').first.click()
        fill(page, "title", "只改示範，不改正式")
        save(page)
        assert stored(page) == formal
        page.locator('[data-act="exit-demo"]').click()
        assert stored(page) == formal
        mark("editing the fictional demo cannot overwrite the formal workspace")

        original_year = workspace(page)["year"]
        page.locator('[data-act="year"]').click()
        fill(page, "year", "2024")
        save(page)
        assert len(workspace(page)["events"]) == 0
        page.locator('[data-act="year"]').click()
        fill(page, "year", str(original_year))
        save(page)
        assert len(workspace(page)["events"]) == 4
        before_reload = workspace(page)
        if MODE == "http":
            page.reload()
        else:
            seed = page.evaluate("window.__atlasStore")
            ctx2, reloaded = create_page(browser, seed=seed)
            ctx.close()
            ctx, page = ctx2, reloaded
        assert workspace(page) == before_reload
        mark("separate yearly workspaces restore (document mode uses explicit storage replay)")

        nav(page, 3)
        page.locator('.page-heading [data-act="theme"]').click()
        fill(page, "name", "這張先不要儲存")
        page.keyboard.press("Escape")
        expect(page.locator("#dialog")).not_to_be_visible()
        assert len(workspace(page)["themes"]) == 1
        assert page.evaluate("document.activeElement.dataset.act") == "theme"
        mark("keyboard Escape cancels drafts and returns focus to the launching control")

        nav(page, 4)
        route_id = workspace(page)["actions"][0]["routeId"]
        page.locator(f'[data-act="route"][data-id="{route_id}"]').click()
        page.locator('#dialog [data-act="delete"]').click()
        page.locator('[data-act="confirm-delete"]').click()
        assert workspace(page)["actions"][0]["routeId"] == ""
        assert len(workspace(page)["reviews"]) == 1
        nav(page, 5)
        page.locator(f'[data-act="action"][data-id="{a["id"]}"]').click()
        page.locator('#dialog [data-act="delete"]').click()
        page.locator('[data-act="confirm-delete"]').click()
        assert len(workspace(page)["reviews"]) == 0
        assert len(workspace(page)["actions"]) == 1
        mark("confirmed deletes clean links; deleting an experiment removes its own reviews only")

        original_raw = page.evaluate("key=>localStorage.getItem(key)", KEY)
        if MODE == "http":
            other = ctx.new_page()
            other.goto(URL)
            other.evaluate("key=>{const x=JSON.parse(localStorage.getItem(key));x.changedElsewhere=true;localStorage.setItem(key,JSON.stringify(x));}", KEY)
        else:
            page.evaluate("key=>{const x=JSON.parse(localStorage.getItem(key));x.changedElsewhere=true;const value=JSON.stringify(x);localStorage.setItem(key,value);window.dispatchEvent(new StorageEvent('storage',{key,newValue:value}));}", KEY)
        expect(page.locator('.workspace>.warning')).to_contain_text("另一個分頁")
        conflict_raw = page.evaluate("key=>localStorage.getItem(key)", KEY)
        page.locator('[data-act="intention"]').click()
        fill(page, "intention", "發生衝突後仍保留在本頁，不覆蓋另一個分頁。")
        save(page)
        assert page.evaluate("key=>localStorage.getItem(key)", KEY) == conflict_raw
        assert conflict_raw != original_raw
        mark("cross-tab update stops auto-save rather than silently overwriting newer data")
        ctx.close()

        blocked_ctx, blocked = create_page(browser, blocked=True)
        expect(blocked.locator('.workspace>.warning')).to_contain_text("無法讀取或寫入")
        nav(blocked, 1)
        blocked.locator('.page-heading [data-act="event"]').click()
        fill(blocked, "title", "儲存被擋時仍可匯出")
        save(blocked)
        assert backup(blocked, "blocked-backup.json")["events"][0]["title"] == "儲存被擋時仍可匯出"
        blocked_ctx.close()
        mark("blocked storage shows a warning but editing and manual backup remain usable")

        for width in [320, 360, 390, 768, 1440]:
            mobile_ctx, view = create_page(browser, width=width, height=844 if width < 800 else 1100)
            view.locator('[data-act="demo"]').click()
            for stage in range(7):
                nav(view, stage)
                assert not overflow(view), f"horizontal overflow at {width}px stage {stage}"
                if width in [390, 1440] and stage in [2, 4, 5, 6]:
                    view.screenshot(path=str(OUT / f'{"mobile" if width==390 else "desktop"}-{stage}.png'), full_page=True)
            nav(view, 5)
            view.locator('.page-heading [data-act="action"]').click()
            assert not view.locator("#dialog").evaluate("el=>el.scrollWidth>el.clientWidth+1"), f"form overflow at {width}px"
            view.get_by_role('button', name='關閉對話框', exact=True).click()
            mobile_ctx.close()
        mark("all seven stages plus forms fit 320/360/390/768/1440px Chromium viewports")

        assert not errors, errors
        assert not external_requests, external_requests
        assert '<script type="module" src=' not in HTML
        assert '<link rel="stylesheet"' not in HTML
        mark("standalone build is self-contained; suite has no page errors or external requests")
        browser.close()
finally:
    if server:
        server.terminate()
        server.wait(timeout=5)
    report = {"mode": MODE, "native_storage_tested": MODE == "http",
              "note": "document mode uses local HTML injection, Storage replay and synthetic storage events; it does not test native reload persistence, HTTP navigation or file URLs" if MODE == "document" else "real local HTTP and browser localStorage",
              "passed": len(results), "cases": results, "page_errors": errors,
              "external_requests": external_requests}
    (OUT / "browser-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps({k: v for k, v in report.items() if k != "cases"}, ensure_ascii=False, indent=2))
