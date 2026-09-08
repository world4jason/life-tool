"""Rating/editor regression checks on the exact standalone build.

Uses the same explicit Storage shim as smoke.py. No external requests, native
origin-persistence claims, or real-device Safari claims are made by this suite.
"""
from smoke import mount, OUT
from playwright.sync_api import sync_playwright
import json
import os

KEY = 'life-atlas.v1.personal'
checks = []


def check(name, condition):
    assert condition, name
    checks.append(name)
    print('PASS', name)


def step(page, index):
    page.locator(f'.steps [data-step="{index}"]').click()


def stored(page):
    return json.loads(page.evaluate('(key) => localStorage.getItem(key)', KEY))


def save(page):
    page.locator('#editor button[type="submit"]').click()
    page.wait_for_function('!document.querySelector("#editor").open')


def edit(page, event_id):
    page.locator(f'[data-action="edit-event"][data-id="{event_id}"]').first.click()


def energy(page):
    return page.locator('#energy-output').inner_text()


def in_initial_view(page, selector):
    return page.locator(selector).evaluate('''el => {
        const rect = el.getBoundingClientRect();
        const body = document.querySelector('#editor .dialog-body');
        const view = body.getBoundingClientRect();
        return body.scrollTop === 0 && rect.top >= view.top - 1 &&
            rect.bottom <= view.bottom + 1 && rect.left >= 0 && rect.right <= innerWidth;
    }''')


def run():
    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            executable_path=os.getenv('CHROMIUM_PATH', '/usr/bin/chromium'),
            headless=True, args=['--no-sandbox'])
        page = mount(browser)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        step(page, 1)
        page.locator('[data-action="add-event"][data-month="1"]').click()
        page.locator('[name="title"]').fill('和老朋友去海邊散步')
        page.locator('[name="facts"]').fill('臨時收到邀約，週末一起走到海邊。聊了一下午，沒有急著安排下一件事。')
        check('origin options are four radio tags, not a select',
              page.locator('.origin-choices input[type="radio"]').count() == 4 and
              page.locator('select[name="origin"]').count() == 0)
        check('default origin remains unsure',
              page.locator('[name="origin"][value="unsure"]').is_checked())
        page.get_by_label('計畫內', exact=True).check()
        page.get_by_label('計畫內', exact=True).focus()
        page.keyboard.press('ArrowRight')
        check('origin tags support native keyboard selection',
              page.get_by_label('意外', exact=True).is_checked() and
              page.locator('[name="origin"]:checked').count() == 1)
        page.screenshot(path=str(OUT / 'origin-tags-desktop.png'))
        save(page)
        first = stored(page)['events'][0]
        event_id = first['id']
        check('selected origin persists with no energy invented',
              first['origin'] == 'surprise' and first['energy'] is None)
        page.locator('[data-action="add-event"][data-month="1"]').click()
        page.locator('[name="title"]').fill('完成一件拖延的小事')
        save(page)
        other_id = stored(page)['events'][1]['id']
        step(page, 2)
        edit(page, event_id)
        check('rating facts are static; only order remains an input',
              page.locator('.rating-summary').count() == 1 and
              page.locator('#editor [name="month"], #editor [name="title"], #editor [name="facts"], #editor [name="origin"], #editor [name="private"]').count() == 0 and
              page.locator('.rating-summary input[name="order"]').count() == 1)
        check('rating shows the selected origin as a read-only tag',
              page.locator('.rating-summary .origin-tag').inner_text() == '意外')
        check('unrated slider is immediately usable without clearing a checkbox',
              page.locator('#event-energy').is_enabled() and energy(page) == '—' and
              page.locator('[name="unrated"]').is_checked())
        save(page)
        check('opening and saving without scoring keeps null and original facts',
              stored(page)['events'][0] == first)
        edit(page, event_id)
        page.locator('#event-energy').fill('7')
        check('slider immediately updates the signed score and rated state',
              energy(page) == '+7' and not page.locator('[name="unrated"]').is_checked() and
              '+7 分' in page.locator('#event-energy').get_attribute('aria-valuetext'))
        page.locator('[name="order"]').fill('2')
        save(page)
        saved = next(e for e in stored(page)['events'] if e['id'] == event_id)
        check('rating save preserves all fact metadata',
              all(saved[key] == first[key] for key in ('id', 'kind', 'month', 'title', 'facts', 'origin', 'private')) and
              saved['energy'] == 7)
        check('reordering swaps occupied monthly positions without losing a card',
              saved['order'] == 2 and
              next(e for e in stored(page)['events'] if e['id'] == other_id)['order'] == 1)
        edit(page, event_id)
        check('existing score is visible immediately on reopening', energy(page) == '+7')
        page.screenshot(path=str(OUT / 'rating-desktop.png'))
        before_cancel = page.evaluate('(key) => localStorage.getItem(key)', KEY)
        page.locator('#event-energy').fill('-6')
        check('negative score and description update together',
              energy(page) == '-6' and page.locator('#energy-meaning').inner_text() == '較耗損')
        page.locator('#editor [data-action="close-dialog"]').first.click()
        check('cancelling discards draft score changes',
              page.evaluate('(key) => localStorage.getItem(key)', KEY) == before_cancel)
        edit(page, event_id)
        page.locator('[name="unrated"]').check()
        check('opting out clears the readout but does not disable future scoring',
              energy(page) == '—' and page.locator('#event-energy').is_enabled())
        save(page)
        check('opting out saves null, not zero', stored(page)['events'][0]['energy'] is None)
        edit(page, event_id)
        page.locator('[data-action="zero-energy"]').click()
        check('zero is an explicit rating, not a placeholder',
              energy(page) == '0' and not page.locator('[name="unrated"]').is_checked())
        save(page)
        check('explicit zero persists', stored(page)['events'][0]['energy'] == 0)
        edit(page, event_id)
        page.locator('[name="unrated"]').check()
        page.locator('#event-energy').focus()
        page.keyboard.press('End')
        check('keyboard can resume scoring from unrated', energy(page) == '+10')
        save(page)
        # Fact editing and origin changes still belong to the facts chapter.
        step(page, 1)
        edit(page, event_id)
        check('facts chapter remains a full editor and resets dialog styling',
              page.locator('[name="title"]').is_editable() and
              page.locator('#editor').get_attribute('data-mode') == '' and
              page.locator('.origin-choices').count() == 1)
        page.get_by_label('混合', exact=True).check()
        page.locator('[name="private"]').check()
        save(page)
        step(page, 2)
        edit(page, event_id)
        check('private rating summary respects masking',
              '和老朋友去海邊散步' not in page.locator('.rating-summary').inner_text() and
              page.locator('.rating-summary .origin-tag').inner_text() == '混合')
        page.locator('#event-energy').fill('3')
        save(page)
        check('rating does not clear privacy or the selected origin',
              stored(page)['events'][0]['private'] and stored(page)['events'][0]['origin'] == 'mixed')
        # New cards from chapter 2 cannot be read-only: they have no facts yet.
        page.locator('[data-action="add-event"]').first.click()
        check('adding from energy chapter still asks for editable event facts',
              page.locator('[name="title"]').is_editable() and page.locator('.origin-choices').count() == 1)
        page.locator('[name="title"]').fill('新加入的片刻')
        page.get_by_label('計畫內', exact=True).check()
        page.locator('#event-energy').fill('4')
        save(page)
        check('new event from energy view saves both facts and score',
              any(e['title'] == '新加入的片刻' and e['origin'] == 'planned' and e['energy'] == 4
                  for e in stored(page)['events']))
        step(page, 1)
        page.locator('[data-action="add-background"]').click()
        page.locator('[name="title"]').fill('每週固定散步')
        save(page)
        background = next(e for e in stored(page)['events'] if e['kind'] == 'background')
        step(page, 2)
        edit(page, background['id'])
        check('background rating has no irrelevant monthly order control',
              page.locator('.rating-summary').count() == 1 and page.locator('[name="order"]').count() == 0)
        page.locator('#event-energy').fill('2')
        save(page)
        updated = next(e for e in stored(page)['events'] if e['id'] == background['id'])
        check('background rating retains kind, order and all fact metadata',
              all(updated[key] == background[key] for key in ('id', 'kind', 'month', 'order', 'title', 'facts', 'origin', 'private')) and
              updated['energy'] == 2)
        # Long titles/facts must not push the score out of the first viewport.
        snapshot = stored(page)
        sample = snapshot['events'][0]
        sample.update(title='和老朋友去海邊散步', facts='臨時收到邀約，週末一起走到海邊。聊了一下午，沒有急著安排下一件事。', private=False, energy=7)
        for width, height in ((1440, 960), (1024, 768), (768, 1024), (390, 844), (375, 667), (320, 568)):
            p = mount(browser, width, height, {KEY: json.dumps(snapshot)})
            p.on('pageerror', lambda error: errors.append(str(error)))
            step(p, 2)
            edit(p, event_id)
            check(f'score and slider visible before scroll at {width}x{height}',
                  in_initial_view(p, '#energy-output') and in_initial_view(p, '#event-energy'))
            check(f'rating has no horizontal overflow at {width}x{height}',
                  p.evaluate('document.documentElement.scrollWidth <= innerWidth + 1') and
                  p.locator('#editor .dialog-body').evaluate('el => el.scrollWidth <= el.clientWidth + 1'))
            if width == 390:
                p.screenshot(path=str(OUT / 'rating-mobile.png'))
            p.close()
        sample.update(title='很長的片刻名稱' * 15, facts=('多行事實不是新的評價。\n' * 80) + '<img src=x onerror=alert(1)>')
        long_page = mount(browser, 320, 568, {KEY: json.dumps(snapshot)})
        step(long_page, 2)
        edit(long_page, event_id)
        check('long summaries keep the score and slider above the fold',
              in_initial_view(long_page, '#energy-output') and in_initial_view(long_page, '#event-energy'))
        long_page.locator('.rating-facts summary').click()
        check('full facts can be expanded without editable fields or HTML injection',
              long_page.locator('.rating-facts[open]').count() == 1 and
              '<img src=x' in long_page.locator('.rating-facts p').inner_text() and
              long_page.locator('#editor img, #editor textarea[name="facts"]').count() == 0)
        # Also inspect all four tags at the smallest supported width.
        long_page.keyboard.press('Escape')
        step(long_page, 1)
        edit(long_page, event_id)
        check('all origin tags retain 44px touch targets at 320px',
              long_page.locator('.origin-choice > span').evaluate_all('els => els.every(el => el.getBoundingClientRect().height >= 44)'))
        check('no uncaught runtime errors', not errors)
        (OUT / 'rating-checks.json').write_text(json.dumps(
            {'passed': len(checks), 'checks': checks, 'storage': 'deterministic shim'},
            ensure_ascii=False, indent=2))
        browser.close()


if __name__ == '__main__':
    run()
