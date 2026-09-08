"""Additional simulated touch, lasso, privacy, and end-to-end canvas route checks."""
from smoke import mount, OUT
from playwright.sync_api import sync_playwright
from importlib import import_module
import json
c=import_module('canvas');checks=[]
def check(name,ok):
 assert ok,name
 checks.append(name);print('PASS',name,flush=True)
def run():
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  p=mount(b,1440,1000);p.set_default_timeout(7000);errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
  c.step(p,1)
  for i,title in enumerate(['旅行','空白週末','工作'],1):
   p.locator(f'[data-action="add-event"][data-month="{i}"]').click();p.locator('[name="title"]').fill(title);p.locator('[name="facts"]').fill(title+'，自己的時間。');c.save(p)
  snapshot=c.raw(p);c.step(p,3);c.group(p);c.wait(p)
  # Drag blank space around two cards to create a selection rectangle.
  first=p.locator('.c-event').nth(0).bounding_box();second=p.locator('.c-event').nth(1).bounding_box()
  sx=first['x']-8;sy=first['y']-7;ex=second['x']+second['width']+8;ey=first['y']+first['height']+7
  p.mouse.move(sx,sy);p.mouse.down();p.mouse.move(ex,ey,steps=12);p.mouse.up();c.wait(p)
  check('marquee selects two event cards without editing their data',p.locator('[data-c-select]:checked').count()==2 and c.raw(p)[c.KEY]==snapshot[c.KEY])
  p.locator('[data-c-action="group"]').click();c.wait(p);p.locator('.canvas-inspector input').fill('自主');p.locator('.canvas-inspector button[type="submit"]').click();c.wait(p)
  gid=c.stored(p)['themes'][0]['id']
  check('the next action stays at the group header',p.locator(f'[data-c-frame="{gid}"] header [data-c-action="options"]').count()==1)
  # Enlarged canvas retains a task prompt and has an Escape exit.
  p.locator('[data-c-action="expand"]').click();c.wait(p)
  check('expanded canvas retains its task and controls',p.locator('.canvas-shell.expanded').count()==1 and p.locator('.canvas-task').is_visible())
  p.keyboard.press('Escape');c.wait(p);check('Escape leaves expanded mode without deleting the group',p.locator('.canvas-shell.expanded').count()==0 and c.stored(p)['themes'][0]['label']=='自主')
  # Explicit layout cleanup does not change semantics; it can be undone.
  previous=c.raw(p)[c.KEY];p.locator('[data-c-action="arrange"]').click();c.wait(p)
  check('automatic arrangement is layout-only',c.raw(p)[c.KEY]==previous)
  p.locator('[data-c-action="undo"]').click();c.wait(p)
  check('arrangement can be undone without touching the group',c.raw(p)[c.KEY]==previous)
  # Carry a named group into a chosen direction and two alternatives.
  p.locator('[data-c-action="fit"]').click();c.wait(p);p.locator(f'[data-c-frame="{gid}"] [data-c-action="options"]').click()
  check('group hands off to an empty future-intention field',p.locator('#discovery-direction-input').input_value()=='')
  p.locator('#discovery-direction-input').fill('保留能由自己安排的時間');p.locator('[data-discovery-form="direction"] button[type="submit"]').click()
  route_ids=[]
  for title,kind in [('週三不排事情','less'),('和主管協商回訊時段','different')]:
   p.locator('.discovery-direction [data-action="add-route"]').click();p.locator('#editor [name="title"]').fill(title);p.locator('#editor [name="kind"]').select_option(kind);p.locator('#editor [name="benefit"]').fill('支持自主安排時間');p.locator('#editor [name="firstStep"]').fill('在週日保留週三晚上');c.save(p);route_ids.append(c.stored(p)['routes'][-1]['id'])
  
  if not p.locator('.journey-canvas').count():p.locator('[data-action="d-map"]').click()
  c.wait(p)
  check('map shows the chosen direction and two independent routes',p.locator('.c-node.direction').count()==1 and p.locator('.c-node.route').count()==2)
  check('map connections come from stored route associations',p.locator('.c-edges path').count()==2 and all(r['themeId']==gid for r in c.stored(p)['routes']))
  p.locator('.journey-canvas [data-action="select-route"]').first.click();p.locator('#editor [name="reason"]').fill('從時間配置減少承諾，不增加活動');c.save(p);c.wait(p)
  check('a route can be chosen from the map, with a reason',c.stored(p)['routes'][0]['selected'] and c.stored(p)['routes'][0]['reason']!='')
  p.locator('.journey-canvas [data-action="route-plan"]').click();p.locator('#editor [name="title"]').fill('每週保留一個晚上');p.locator('#editor [name="acceptance"]').fill('行事曆保留兩小時，不安排工作');c.save(p)
  node=c.stored(p)['nodes'][-1]
  check('the action keeps its route, direction and measurable acceptance',node['routeId']==route_ids[0] and node['themeIds']==[gid] and node['acceptance']!='')
  c.step(p,4);c.wait(p);p.locator('[data-c-action="fit"]').click();c.wait(p)
  check('a created action appears on the same lineage map',p.locator('.c-node.action').count()==1)
  p.locator('.c-node.action [data-action="edit-node"]').click();check('map action editing uses the actual action editor',p.locator('#editor [name="title"]').input_value()=='每週保留一個晚上');p.keyboard.press('Escape')
  c.step(p,6);p.locator(f'[data-action="log-node"][data-id="{node["id"]}"]').click();p.locator('#editor [name="note"]').fill('做到了，時間安排比較自主');c.save(p)
  check('review remains connected to the actual action',c.stored(p)['reviews'][-1]['nodeId']==node['id'])
  c.step(p,4);c.wait(p);p.locator('[data-c-action="fit"]').click();c.wait(p);p.screenshot(path=str(OUT/'canvas-journey-desktop.png'),full_page=True)
  # Private content must not leak through canvas cards, accessible labels or dialogs.
  data=json.loads(snapshot[c.KEY]);data['events'][0].update(private=True,title='PRIVATE-SENTINEL',facts='<img src=x onerror=alert(1)>PRIVATE-SENTINEL')
  q=mount(b,1440,1000,{c.KEY:json.dumps(data)});c.step(q,3);c.group(q)
  check('private content is masked in canvas text and labels','PRIVATE-SENTINEL' not in q.locator('#main').inner_text() and 'PRIVATE-SENTINEL' not in q.locator('.canvas-shell').get_attribute('aria-label') and q.locator('.canvas-shell img').count()==0)
  q.locator('.c-event [data-c-action="inspect"]').first.click();check('read-only inspection keeps private content masked','PRIVATE-SENTINEL' not in q.locator('#editor').inner_text());q.keyboard.press('Escape');q.close()
  # Native touch events, not mouse events in a narrow viewport.
  m=mount(b,390,844,snapshot);c.step(m,3);c.group(m);c.mode(m,'canvas');m.locator('[data-c-action="fit"]').click();c.wait(m);m.locator('[data-canvas-stage]').scroll_into_view_if_needed()
  ses=m.context.new_cdp_session(m);h=m.locator('[data-c-grip^="card:pool:"]').first.bounding_box();t=m.locator('[data-c-frame="new"]').bounding_box()
  sx=h['x']+h['width']/2;sy=h['y']+h['height']/2;tx=t['x']+t['width']/2;ty=t['y']+t['height']/2
  ses.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':sx,'y':sy}]})
  for i in range(1,13):ses.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':sx+(tx-sx)*i/12,'y':sy+(ty-sy)*i/12}]})
  ses.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});c.wait(m)
  check('touch dragging can create a group and request its name',len(c.stored(m)['themes'])==1 and m.locator('.canvas-inspector input').is_visible())
  before=c.raw(m)[c.KEY];m.locator('[data-canvas-stage]').scroll_into_view_if_needed();r=m.locator('[data-canvas-stage]').bounding_box();a=r['x']+95;y=r['y']+140;old=m.locator('.canvas-world').get_attribute('style')
  ses.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'id':1,'x':a,'y':y},{'id':2,'x':a+90,'y':y}]})
  for i in range(1,7):ses.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'id':1,'x':a-i*4,'y':y},{'id':2,'x':a+90+i*4,'y':y}]})
  ses.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});c.wait(m)
  check('two-finger zoom changes the camera but not the content',m.locator('.canvas-world').get_attribute('style')!=old and c.raw(m)[c.KEY]==before)
  check('no uncaught errors in the full canvas-to-review journey',not errors)
  (OUT/'canvas-journey-checks.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'touch':'Chromium CDP, not a physical phone'},ensure_ascii=False,indent=2));b.close()
if __name__=='__main__':run()
