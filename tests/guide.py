"""Guided demo regression on the single-file build; deterministic Storage shim.
No native origin persistence or physical device claims. Run after npm run build.
"""
from smoke import mount, OUT
from playwright.sync_api import sync_playwright
import os, json
KEY = 'life-atlas.v1.personal'
checks = []
def check(name, value):
    assert value, name
    checks.append(name)
    print('PASS', name, flush=True)
def action(p, name): p.locator(f'[data-action="{name}"]').first.click()
def step(p, n): p.locator(f'.steps [data-step="{n}"]').click()
def fill(p, name, value): p.locator(f'#editor [name="{name}"]').fill(str(value))
def save(p):
    p.locator('#editor button[type="submit"]').click()
    p.wait_for_function('!document.querySelector("#editor").open')
def snapshot(p): return p.evaluate('({...window.__storageData})')
def data(p): return json.loads(snapshot(p)[KEY])

def run():
  with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    p = mount(b); errors=[]; p.on('pageerror',lambda e: errors.append(str(e)))
    p.screenshot(path=str(OUT/'guide-home-desktop.png'),full_page=True)
    check('home offers interactive guide and personal entry',p.get_by_role('button',name='跟著示範做').count()==1 and p.get_by_role('button',name='開始我的回顧').count()==1)
    check('decorative subtitles and lectures removed',p.locator('.coach-strip, .side-caption, .side-note, .hero-copy .eyebrow, .page-heading .eyebrow').count()==0)
    step(p,1);action(p,'add-event');fill(p,'title','我的私人回顧');fill(p,'facts','不可被示範取代');p.locator('[name="private"]').check();save(p)
    original = snapshot(p)
    action(p,'start-guide')
    check('guide starts at facts with one instruction',p.locator('.step.active').get_attribute('data-step')=='1' and p.locator('.guide-instruction').count()==1)
    check('sample does not insert itself into personal storage',snapshot(p)==original)
    action(p,'guide-task');fill(p,'facts','示範：留了兩天空白');p.locator('[name="origin"][value="mixed"]').check();save(p)
    check('real editor saves practice but not personal data',p.locator('.guide-result').inner_text()=='已練習' and snapshot(p)==original)
    action(p,'guide-next');action(p,'guide-task')
    check('rating retains read-only facts and origin tag',p.locator('#editor [name="title"]').count()==0 and p.locator('#editor .origin-tag').inner_text()=='混合')
    check('guide focuses enabled score slider',p.locator('[name="energy"]').is_enabled() and p.evaluate('document.activeElement.name')=='energy')
    fill(p,'energy',8)
    p.screenshot(path=str(OUT/'guide-rating-desktop.png'),full_page=True)
    save(p);check('score updates on actual card',p.locator('.guide-target .energy').inner_text()=='+8')
    action(p,'guide-next');action(p,'guide-task');fill(p,'label','留白與自主');save(p)
    check('theme name can be changed in tutorial','留白與自主' in p.locator('#main').inner_text())
    action(p,'guide-next')
    check('options include three genuinely different routes',p.locator('.route-card').count()==3)
    # Choose another route, not the one in the shortcut. The next sample must follow it.
    p.locator('[data-action="select-route"][data-id="demo-route-2"]').click();fill(p,'reason','想先換個環境');save(p)
    action(p,'guide-next');action(p,'guide-task')
    check('experiment follows the chosen alternative',p.locator('[name="routeId"]').input_value()=='demo-route-2' and p.locator('[name="period"]').input_value()=='month')
    fill(p,'target',2);save(p)
    action(p,'guide-next');action(p,'guide-task');fill(p,'amount',1);fill(p,'note','試過之後發現準備時間太多');p.locator('[name="direction"]').select_option('drains');p.locator('[name="decision"]').select_option('reduce');save(p)
    check('review records execution and direction independently','試過之後發現準備時間太多' in p.locator('#main').inner_text() and snapshot(p)==original)
    action(p,'guide-next');action(p,'guide-finish')
    check('finish restores personal data and private mask',snapshot(p)==original and '我的私人回顧' not in p.locator('#app').inner_text() and p.locator('.guide-bar').count()==0)
    # Reentry, skipping and back navigation do not imply completion.
    action(p,'start-guide');step(p,6)
    check('skipping chapters supplies example without claiming practice',p.locator('[data-action="guide-task"]').count()==1 and p.locator('.guide-result').inner_text()=='可直接看下一步')
    action(p,'guide-task');p.keyboard.press('Escape');action(p,'guide-back')
    check('back and Escape keep navigation usable',p.locator('.step.active').get_attribute('data-step')=='5' and not p.locator('#editor').evaluate('(d)=>d.open'))
    action(p,'guide-exit');check('early exit preserves bytes',snapshot(p)==original)
    # Unsaved personal in-memory edits survive an entire guide session.
    q=mount(b,storage=original);q.evaluate('window.__storageFail=true');step(q,1);action(q,'add-event');fill(q,'title','儲存失敗但仍保留');save(q)
    check('quota failure visible before practice','尚未儲存' in q.locator('.save-status').inner_text())
    action(q,'start-guide');action(q,'guide-task');save(q);action(q,'guide-exit')
    check('guide restores unsaved personal edits and warning','儲存失敗但仍保留' in q.locator('#app').inner_text() and '尚未儲存' in q.locator('.save-status').inner_text() and snapshot(q)==original)
    # Changes made by another tab cannot be overwritten on returning.
    r=mount(b,storage=original);action(r,'start-guide');external=data(r);external['year']=2024;external['revision']+=1
    r.evaluate('([k,v])=>window.__storageData[k]=v',[KEY,json.dumps(external)])
    action(r,'guide-exit')
    check('return detects another tab version','另一個分頁' in r.locator('.warning-banner').inner_text() and data(r)['year']==2024)
    # Corrupt personal storage still permits a disposable tour and returns to recovery.
    c=mount(b,storage={KEY:'invalid'});action(c,'start-guide');action(c,'guide-task');save(c);action(c,'guide-exit')
    check('recovery data remains byte-for-byte intact',snapshot(c)[KEY]=='invalid' and c.locator('.recovery').count()==1)
    # Same-origin source navigation is blocked by the environment; test exact bundled HTML.
    layout=mount(b);action(layout,'start-guide')
    layout_checks=0
    for width,height in [(320,640),(390,844),(768,1024),(1024,900),(1440,1050)]:
      layout.set_viewport_size({'width':width,'height':height})
      for chapter in range(1,7):
        step(layout,chapter)
        assert not layout.evaluate('document.documentElement.scrollWidth>innerWidth+1'),(width,chapter)
        action(layout,'guide-task')
        assert not layout.locator('#editor').evaluate('(d)=>d.scrollWidth>d.clientWidth+1'),(width,chapter,'dialog')
        assert layout.locator('#editor button[type="submit"]').is_visible(),(width,chapter,'save')
        layout.keyboard.press('Escape');layout_checks+=1
      if width==390:
        step(layout,2);layout.screenshot(path=str(OUT/'guide-mobile.png'),full_page=True)
      if width==1440:
        step(layout,4);layout.screenshot(path=str(OUT/'guide-options-desktop.png'),full_page=True)
    check('30 chapter/viewport pairs and dialogs fit',layout_checks==30)
    check('no uncaught page errors',not errors)
    (OUT/'guide-checks.json').write_text(json.dumps({'checks':checks,'passed':len(checks),'layoutPairs':layout_checks,'environment':'Chromium + deterministic Storage shim; not physical mobile/native persistence'},ensure_ascii=False,indent=2))
    b.close()
if __name__=='__main__':run()
