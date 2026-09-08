"""UI/UX regression on exact standalone bytes; deterministic Storage, not a real-device study."""
from smoke import mount, OUT
from playwright.sync_api import sync_playwright
import json, os
KEY='life-atlas.v1.personal'
checks=[]
def check(name, ok):
 assert ok,name
 checks.append(name);print('PASS',name,flush=True)
def click(p,a):p.locator(f'[data-action="{a}"]').first.click()
def step(p,n):p.locator(f'.steps [data-step="{n}"]').click()
def save(p):p.locator('#editor button[type="submit"]').click();p.wait_for_function('!document.querySelector("#editor").open')
def stored(p):return json.loads(p.evaluate('(k)=>localStorage.getItem(k)',KEY))
def raw(p):return p.evaluate('({...window.__storageData})')
def wait(p):p.wait_for_timeout(90)
def center(el):
 r=el.bounding_box();return (r['x']+r['width']/2,r['y']+r['height']/2)
def drag(p,el,x,y):
 a,b=center(el);p.mouse.move(a,b);p.mouse.down();p.mouse.move(x,y,steps=16);p.mouse.up();wait(p)
def group(p):
 p.locator('[data-action="d-mode"][data-mode="group"]').click();wait(p)
def mode(p,surface):
 p.locator(f'[data-action="d-surface"][data-surface="{surface}"]').click();wait(p)
def run():
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
  p=mount(b,1440,1000);p.set_default_timeout(6000);errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
  step(p,1)
  for month,title in [(1,'旅行'),(2,'保留週末'),(3,'工作交付')]:
   p.locator(f'[data-action="add-event"][data-month="{month}"]').click();p.locator('[name="title"]').fill(title);p.locator('[name="facts"]').fill(title+'的完整內容');save(p)
  initial=stored(p);ids=[e['id'] for e in initial['events']]
  step(p,3);group(p)
  check('desktop grouping opens an actual zoomable canvas',p.locator('[data-canvas-stage]').count()==1)
  check('instructions name the action, not an abstract empty state','成群' in p.locator('.discovery-instruction').inner_text())
  for id in ids[:2]:p.locator(f'[data-c-select="card:pool:{id}"]').check()
  check('selecting cards enables the group action',p.locator('[data-c-action="group"]').is_enabled())
  p.locator('[data-c-action="group"]').click();wait(p)
  name=p.locator('.canvas-inspector input[name="label"]')
  check('group creation focuses an unscaled name field',name.is_visible() and name.evaluate('el=>document.activeElement===el'))
  name.fill('自主');p.locator('.canvas-inspector button[type="submit"]').click();wait(p)
  s=stored(p);gid=s['themes'][0]['id']
  check('group contains references, not duplicate events',set(s['themes'][0]['eventIds'])==set(ids[:2]) and len(s['events'])==3)
  check('naming does not invent an objective',not s['themes'][0]['intention'] and not s['nodes'])
  # Frame movement edits only presentation state.
  before=p.evaluate('(k)=>localStorage.getItem(k)',KEY)
  p.locator('[data-c-location]').select_option('frame:'+gid);wait(p)
  grip=p.locator(f'[data-c-frame="{gid}"] [data-c-grip]');x,y=center(grip)
  drag(p,grip,x-60,y+38)
  check('dragging a group preserves every domain byte',p.evaluate('(k)=>localStorage.getItem(k)',KEY)==before)
  check('layout is saved separately with no event text',any(k.startswith('life-atlas.canvas.v1.') for k in raw(p)) and all('完整內容' not in v for k,v in raw(p).items() if k.startswith('life-atlas.canvas.v1.')))
  p.locator('[data-c-action="undo"]').click();wait(p)
  check('layout undo also preserves domain data',p.evaluate('(k)=>localStorage.getItem(k)',KEY)==before)
  p.locator('[data-c-action="redo"]').click();wait(p)
  check('layout redo is available without changing memberships',len(stored(p)['themes'][0]['eventIds'])==2)
  p.locator('[data-c-action="fit"]').click();wait(p)
  # The remaining card can be dropped into the named group.
  source=p.locator(f'[data-c-grip="card:pool:{ids[2]}"]')
  target=p.locator(f'[data-c-frame="{gid}"]');r=target.bounding_box()
  drag(p,source,r['x']+r['width']/2,r['y']+r['height']/2)
  check('canvas drop changes membership once',set(stored(p)['themes'][0]['eventIds'])==set(ids))
  p.locator('[data-c-action="undo"]').click();wait(p)
  check('semantic undo restores membership after a drop',set(stored(p)['themes'][0]['eventIds'])==set(ids[:2]))
  p.locator('[data-c-action="redo"]').click();wait(p)
  check('semantic redo replays the same drop without duplicate memberships',set(stored(p)['themes'][0]['eventIds'])==set(ids))
  p.locator('[data-c-action="undo"]').click();wait(p)
  # Camera does not corrupt stored classifications.
  data_before=p.evaluate('(k)=>localStorage.getItem(k)',KEY)
  camera_before=p.locator('.canvas-world').get_attribute('style')
  p.locator('[data-c-action="zoom-in"]').click();wait(p)
  check('zoom transforms the canvas, not just its scrollbar',p.locator('.canvas-world').get_attribute('style')!=camera_before)
  p.locator('[data-canvas-stage]').focus();p.keyboard.press('0');wait(p)
  check('keyboard zero resets zoom without a button event',p.locator('#canvas-zoom-level').inner_text()=='100%')
  p.keyboard.press('-');wait(p)
  check('keyboard minus changes camera without modifying content',p.locator('#canvas-zoom-level').inner_text()!='100%' and p.evaluate('(k)=>localStorage.getItem(k)',KEY)==data_before)
  p.locator('[data-c-action="pan-tool"]').click();wait(p)
  check('tool selection has one active state',p.locator('.c-tools [aria-pressed="true"]').count()==1)
  st=p.locator('[data-canvas-stage]');r=st.bounding_box();p.mouse.move(r['x']+r['width']-25,r['y']+50);p.mouse.down();p.mouse.move(r['x']+r['width']-85,r['y']+95,steps=5);p.mouse.up();wait(p)
  check('pan and zoom do not modify content',p.evaluate('(k)=>localStorage.getItem(k)',KEY)==data_before)
  p.locator('[data-c-action="fit"]').click();p.locator('[data-c-action="select-tool"]').click();wait(p)
  # Cancel a drag, no accidental classification.
  source=p.locator(f'[data-c-grip="card:pool:{ids[2]}"]');x,y=center(source);p.mouse.move(x,y);p.mouse.down();p.mouse.move(x+70,y+40,steps=4);p.keyboard.press('Escape');p.mouse.up();wait(p)
  check('Escape cancels a pending drag',p.evaluate('(k)=>localStorage.getItem(k)',KEY)==data_before)
  # Equivalent keyboard/button path.
  source_card=p.locator(f'[data-c-key="card:pool:{ids[2]}"]');source_card.focus();p.keyboard.press('Space')
  check('space selects a focused card',source_card.locator('[data-c-select]').is_checked())
  move_button=source_card.locator('[data-c-action="move"]');move_button.focus();p.keyboard.press('Enter');wait(p)
  check('Enter activates an actual button rather than selecting its parent',p.locator('#editor').evaluate('el=>el.open'))
  p.keyboard.press('Escape');wait(p)
  # Native task interface remains available on all sizes.
  mode(p,'task');check('list alternative uses the same saved groups',p.locator('.discovery-group').count()==1)
  # Explicit binary states work on canvas as well as in the sequential view.
  p.locator('[data-action="d-mode"][data-mode="binary"]').click();p.locator('#discovery-word').fill('自由');p.locator('[data-discovery-form="word"] button[type="submit"]').click();wait(p)
  mode(p,'canvas');check('binary canvas has exactly three state regions',p.locator('[data-c-frame]').count()==3)
  for index,target in [(0,'related'),(1,'unrelated')]:
   source=p.locator(f'[data-c-grip="card:pending:{ids[index]}"]');dest=p.locator(f'[data-c-frame="{target}"]');r=dest.bounding_box();drag(p,source,r['x']+r['width']/2,r['y']+100)
  binary=next(t for t in stored(p)['themes'] if t['method']=='binary')
  check('binary drag distinguishes related, unrelated and unjudged',binary['eventIds']==[ids[0]] and binary['unrelatedEventIds']==[ids[1]] and ids[2] not in binary['eventIds']+binary['unrelatedEventIds'])
  # Persisted layout survives a reload with the same workspace ID.
  snapshot=raw(p);q=mount(b,1440,1000,snapshot);step(q,3);group(q)
  check('layout storage can be restored without altering groups',stored(q)['themes']==stored(p)['themes'])
  # Isolated practice including movement never touches personal storage.
  base=raw(q);q.locator('[data-action="d-practice"]').click();wait(q)
  check('demo puts its two instruction targets in the first row',q.locator('.c-event').nth(0).inner_text().find('旅行')>=0 and '把週末還給自己' in q.locator('.c-event').nth(1).inner_text())
  for el in q.locator('[data-c-select]').all()[:2]:el.check()
  q.locator('[data-c-action="group"]').click();wait(q);q.locator('.canvas-inspector input').fill('示範詞');q.locator('.canvas-inspector button[type="submit"]').click();wait(q)
  q.locator('[data-action="guide-exit"]').first.click();wait(q)
  check('practice never writes or replaces personal records or layout',raw(q)==base)
  q.close()
  # Viewport and touch-target checks, normal task defaults on phones.
  for width,height in [(320,640),(390,844),(768,1024),(1280,900),(1440,1000)]:
   q=mount(b,width,height,snapshot);q.on('pageerror',lambda e:errors.append(str(e)));step(q,3);group(q)
   check(f'no horizontal page overflow at {width}',q.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
   if width<1100: check(f'{width}px defaults to a non-canvas task interface',q.locator('[data-canvas-stage]').count()==0)
   if width<800:
    box=q.locator('[data-discovery-select]').first
    if box.count():
     box.check()
     check(f'{width}px selected-card action bar stays compact and below content',q.locator('.discovery-selection').evaluate('el=>{const r=el.getBoundingClientRect();return r.height<=100 && r.bottom<=innerHeight && r.top>=innerHeight-120}'))
     box.uncheck()
   mode(q,'canvas');check(f'canvas controls fit at {width}',q.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
   if width==390:
    check('phone canvas toolbar has 44px tap targets',q.locator('.canvas-toolbar .c-button').evaluate_all('els=>els.every(el=>el.getBoundingClientRect().height>=44)'))
    q.screenshot(path=str(OUT/'canvas-mobile.png'),full_page=True)
    mode(q,'task');q.screenshot(path=str(OUT/'canvas-mobile-task.png'),full_page=True)
   if width==1440:q.screenshot(path=str(OUT/'canvas-desktop.png'),full_page=True)
   q.close()
  check('no uncaught JavaScript errors',not errors)
  (OUT/'canvas-checks.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'storage':'deterministic shim','physical_devices':False},ensure_ascii=False,indent=2))
  b.close()
if __name__=='__main__':run()
