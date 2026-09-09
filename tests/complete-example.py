"""Completed-example regression on bundled HTML and explicit Storage doubles.
No live-origin persistence or real-device claim is made by this suite.
"""
from smoke import mount, OUT, HTML, STORAGE_SCRIPT
from playwright.sync_api import sync_playwright
import os,json
KEY='life-atlas.v1.personal'
checks=[]
def check(name,ok):
 assert ok,name
 checks.append(name);print('PASS',name,flush=True)
def click(p,a):p.locator(f'[data-action="{a}"]').first.click()
def step(p,n):p.locator(f'.steps [data-step="{n}"]').click()
def raw(p):return p.evaluate('({...window.__storageData})')
def save(p):
 p.locator('#editor button[type="submit"]').click()
 p.wait_for_function('!document.querySelector("#editor").open')
def export_case(p):
 step(p,0)
 with p.expect_download() as d:click(p,'example-export')
 return json.loads(open(d.value.path()).read())
def run():
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
  p=mount(b);p.set_default_timeout(5000);errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
  check('home distinguishes complete example, guided practice and personal entry',p.get_by_role('button',name='看完整範例').count()==1 and p.get_by_role('button',name='跟著示範做').count()==1 and p.get_by_role('button',name='開始我的回顧').count()==1)
  step(p,1);click(p,'add-event');p.locator('[name="title"]').fill('我的私密事件');p.locator('[name="private"]').check();save(p);original=raw(p)
  click(p,'home');click(p,'start-example')
  check('one click opens a fully filled case with six chapter shortcuts',p.locator('.case-stage').count()==6 and p.locator('h1').inner_text()=='把時間留回生活')
  check('case states fictional dates and disposable edits','2026/1/5' in p.locator('.demo-banner').inner_text() and '試改不儲存' in p.locator('.save-status').inner_text())
  p.screenshot(path=str(OUT/'complete-example-desktop.png'),full_page=True)
  step(p,1);check('facts cover all twelve months',p.locator('.month-cell').count()==12 and p.locator('.month-event').count()==18)
  step(p,2);check('all event scores are supplied including actual zero',p.locator('.timeline-svg polyline').count()==1 and '0 張還沒評分' in p.locator('.panel-head').inner_text())
  click(p,'edit-event');check('complete example keeps score-only editor',p.locator('[name="energy"]').count()==1 and p.locator('[name="feelings"], [name="order"]').count()==0)
  p.locator('[name="energy"]').fill('-2');save(p);check('editing does not touch any browser storage',raw(p)==original)
  step(p,3);check('two binary words have completed decisions',p.locator('.discovery-word-tab').count()==2 and '未判斷 0' in p.locator('#discovery').inner_text())
  p.locator('[data-action="d-mode"][data-mode="group"]').click();check('group mode contains three completed named groups',all(x in p.locator('#discovery').inner_text() for x in ['留白','陪伴','身體']))
  check('complete-case guidance does not ask user to build missing data',p.locator('.case-guide').is_visible() and not p.locator('.discovery-coach').is_visible())
  step(p,4);check('options contain three populated alternatives for selected direction',p.locator('.route-card').count()==3 and '每週保留兩個空白晚上' in p.locator('.route-grid').inner_text())
  check('resource budget counts choices across both directions','5' in p.locator('.resource-grid').inner_text() and '1,600' in p.locator('.resource-grid').inner_text())
  p.locator('#stress-toggle').check();check('half-time case reveals over-budget choice',p.locator('.resource.over').count()==1)
  step(p,5);check('O, KR and three action metrics are prefilled',p.locator('.node-card').count()>=5 if p.locator('.node-card').count() else '每週跳舞兩次' in p.locator('#main').inner_text())
  p.locator('[data-action="edit-node"][data-id="case-a-dance"]').click();check('action editor has numbers and acceptance',p.locator('[name="target"]').input_value()=='2' and bool(p.locator('[name="acceptance"]').input_value()) and p.locator('[name="reviewDate"]').input_value()=='2026-01-18');p.keyboard.press('Escape')
  step(p,6);check('review opens at case date rather than current week',p.locator('#review-date').input_value()=='2026-01-18')
  check('review is prefilled, including zero rather than missing data',p.locator('.log-row').count()==11 and p.locator('.review-count strong').all_inner_texts()==['3','1','1','0'])
  p.locator('[data-action="example-week"][data-date="2026-01-11"]').click();check('first week shows completed frequencies',p.locator('.review-count strong').all_inner_texts()==['—','2','2','1'])
  p.locator('[data-action="example-week"][data-date="2026-01-18"]').click()
  p.screenshot(path=str(OUT/'complete-example-review.png'),full_page=True)
  p.locator('[data-action="log-node"][data-id="case-a-dance"]').click();check('new sample log defaults to selected case date',p.locator('[name="date"]').input_value()=='2026-01-18');p.keyboard.press('Escape')
  s=export_case(p);check('export is the displayed fixture, not private records',len(s['events'])==20 and s['events'][0]['energy']==-2 and '我的私密事件' not in json.dumps(s,ensure_ascii=False))
  click(p,'example-reset');p.keyboard.press('Escape');check('reset can be cancelled without losing edits',export_case(p)['events'][0]['energy']==-2)
  click(p,'example-reset');save(p);check('confirmed reset restores full original values',export_case(p)['events'][0]['energy']==4)
  click(p,'start-guide');check('practice remains unfinished intentionally',p.locator('.guide-bar').count()==1 and p.locator('.case-overview').count()==0)
  click(p,'guide-exit');check('switching example to practice still returns to original private workspace',raw(p)==original and p.locator('.case-session').count()==0)
  # Preservation of unsaved, corrupt and concurrently updated personal workspaces.
  q=mount(b,storage=original);q.evaluate('window.__storageFail=true');step(q,1);click(q,'add-event');q.locator('[name="title"]').fill('尚未存檔的內容');save(q);click(q,'home');click(q,'start-example');click(q,'guide-exit');step(q,1)
  check('unsaved memory and warning survive completed case','尚未存檔的內容' in q.locator('#main').inner_text() and '尚未儲存' in q.locator('.save-status').inner_text() and raw(q)==original)
  r=mount(b,storage=original);click(r,'start-example');other=json.loads(original[KEY]);other['revision']+=1;r.evaluate('([k,v])=>window.__storageData[k]=v',[KEY,json.dumps(other)]);click(r,'guide-exit')
  check('return detects external changes without overwriting them','另一個分頁' in r.locator('.warning-banner').inner_text() and json.loads(raw(r)[KEY])['revision']==other['revision'])
  c=mount(b,storage={KEY:'broken'});click(c,'start-guide');step(c,0);click(c,'start-example');click(c,'guide-exit')
  check('damaged personal record survives practice to case switch',raw(c)[KEY]=='broken' and c.locator('.recovery').count()==1)
  # Direct offline entry. No network navigation is used or bypassed.
  entry=b.new_page();entry.evaluate(STORAGE_SCRIPT,{})
  entry.set_content(HTML.replace('<html lang="zh-Hant">','<html lang="zh-Hant" data-example="true">'),wait_until='load')
  check('standalone case opens completed fixture without extra setup',entry.locator('.case-overview').count()==1)
  layout=mount(b);click(layout,'start-example');pairs=0
  for w,h in [(320,640),(390,844),(768,1024),(1024,900),(1440,1050)]:
   layout.set_viewport_size({'width':w,'height':h})
   for chapter in range(7):
    step(layout,chapter);assert layout.locator('h1').count()==1,(w,chapter)
    assert not layout.evaluate('document.documentElement.scrollWidth>innerWidth+1'),(w,chapter)
    if chapter: assert layout.locator('.case-guide').is_visible()
    pairs+=1
   if w==390:
    step(layout,0);layout.screenshot(path=str(OUT/'complete-example-mobile.png'),full_page=True)
  check('35 viewport/chapter pairs fit and retain navigation',pairs==35)
  check('no uncaught runtime errors',not errors)
  (OUT/'complete-example-checks.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'layoutPairs':pairs,'environment':'Chromium; deterministic Storage double. No physical-device or native HTTP persistence claim.'},ensure_ascii=False,indent=2))
  b.close()
if __name__=='__main__':run()
