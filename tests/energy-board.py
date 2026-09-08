"""Energy-only and month ordering regression on the bundled local HTML.
Mouse and CDP touch events drive the real handlers. Storage is an explicit shim;
this suite does not establish native persistence or physical Safari support.
"""
from smoke import mount, OUT
from playwright.sync_api import sync_playwright
import json, os, subprocess
KEY = 'life-atlas.v1.personal'
checks = []
def check(name, value):
    assert value, name
    checks.append(name); print('PASS', name, flush=True)
def step(p, n): p.locator(f'.steps [data-step="{n}"]').click()
def act(p, action): p.locator(f'[data-action="{action}"]').first.click()
def stored(p): return json.loads(p.evaluate('(key) => localStorage.getItem(key)', KEY))
def raw(p): return p.evaluate('(key) => localStorage.getItem(key)', KEY)
def order(p, month=1):
    return p.locator(f'[data-month-sort="{month}"] > [data-sort-id]').evaluate_all('els => els.map(e => e.dataset.sortId)')
def save(p):
    p.locator('#editor button[type="submit"]').click()
    p.wait_for_function('!document.querySelector("#editor").open', timeout=3000)
def fixture():
    return json.loads(subprocess.check_output(['node', '--input-type=module', '-e', '''
      import {blankState,newEvent,validateState} from './src/domain.mjs';
      const s=blankState(2025);
      for(const [id,month,title,energy] of [['a',1,'完成專案交付',-6],['b',1,'和朋友去海邊散步',7],['c',1,'加入固定練舞課',4],['d',2,'安排短旅行',null],['e',2,'重新分配工作',3]])
        s.events.push({...newEvent(month,s.events),id,title,energy,facts:'這是測試用的虛構事件。',origin:'mixed',feelings:['原有感受詞'],influence:'shared',important:true});
      s.events.push({...newEvent(1,[],'background'),id:'bg',title:'每天通勤',feelings:['原有感受詞'],energy:-2});
      s.reflection={notice:'保留的舊觀察',surprise:'舊內容',keep:'舊記錄',release:'舊筆記'};
      console.log(JSON.stringify(validateState(s)));
    '''], text=True))
def prepare(p, month=1):
    step(p, 2); act(p, 'view-list')
    p.locator(f'[data-action="month"][data-month="{month}"]').click()
def positions(p, source, dest, after=True):
    grip=p.locator(f'[data-reorder-handle][data-id="{source}"]')
    grip.scroll_into_view_if_needed()
    group=grip.locator('xpath=ancestor::*[@data-month-sort]')
    group.evaluate("e => e.scrollIntoView({block:'start'})")
    p.evaluate('window.scrollBy(0,-180)')
    a=grip.bounding_box(); c=p.locator(f'[data-sort-id="{dest}"]').bounding_box()
    horizontal=group.evaluate("e => getComputedStyle(e).gridTemplateColumns.trim().split(/\\s+/).length>1")
    return (a['x']+a['width']/2, a['y']+a['height']/2), (c['x']+c['width']*(.82 if after and horizontal else .18 if horizontal else .5), c['y']+c['height']*(.82 if after and not horizontal else .18 if not horizontal else .5))
def mouse_drag(p, source, dest, after=True, cancel=False):
    a,b=positions(p,source,dest,after)
    p.mouse.move(*a); p.mouse.down(); p.mouse.move(*b,steps=12)
    if cancel: p.keyboard.press('Escape')
    p.mouse.up(); p.wait_for_timeout(380)
def run():
  data=fixture(); snap={KEY:json.dumps(data,ensure_ascii=False)}; errors=[]
  with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    p=mount(b,1440,960,snap); p.on('pageerror',lambda e: errors.append(str(e)));p.set_default_timeout(5000)
    prepare(p)
    check('observation panel and action removed',p.locator('.reflection-prompt,[data-action="reflection"]').count()==0)
    check('event cards omit feelings and importance labels', '原有感受詞' not in p.locator('#main').inner_text() and '對我重要' not in p.locator('#main').inner_text())
    check('month grouping follows stored chronology',order(p)==['a','b','c'])
    check('background is not part of monthly ordering',p.locator('.energy-background [data-reorder-handle]').count()==0)
    check('move buttons expose boundaries without number inputs',p.locator('[data-id="a"][data-month-move="-1"]').is_disabled() and p.locator('[data-id="c"][data-month-move="1"]').is_disabled() and p.locator('#main [name="order"]').count()==0)
    p.locator('[data-sort-id="b"] [data-action="edit-event"]').click()
    check('rating form is energy only',p.locator('#editor [name="order"],#editor [name="feelings"],#editor [name="customFeelings"],#editor [name="influence"],#editor [name="important"]').count()==0)
    check('fact summary and origin are read-only',p.locator('.rating-summary').count()==1 and p.locator('.rating-summary input,.rating-summary select,.rating-summary textarea').count()==0 and p.locator('.rating-summary .origin-tag').inner_text()=='混合')
    p.locator('[name="energy"]').fill('8');save(p)
    expected={**data['events'][1],'energy':8}
    check('score save preserves all omitted metadata and old observations',stored(p)['events'][1]==expected and stored(p)['reflection']==data['reflection'])
    p.locator('[data-sort-id="d"]').count()  # month filter keeps February off-screen
    p.locator('[data-id="a"][data-month-move="1"]').click()
    check('arrow button reorders immediately without opening a dialog',order(p)==['b','a','c'] and not p.locator('#editor').evaluate('e=>e.open'))
    grip=p.locator('[data-reorder-handle][data-id="a"]');grip.focus();p.keyboard.press('End')
    check('keyboard End inserts at month end',order(p)==['b','c','a'] and p.evaluate('document.activeElement.dataset.id')=='a')
    p.keyboard.press('Home');check('keyboard Home inserts at month start',order(p)==['a','b','c'])
    before=stored(p);mouse_drag(p,'a','c')
    check('desktop drag inserts rather than swaps',order(p)==['b','c','a'])
    check('drop commits once and retains month and fields',stored(p)['revision']==before['revision']+1 and all({k:v for k,v in e.items() if k!='order'}=={k:v for k,v in next(x for x in before['events'] if x['id']==e['id']).items() if k!='order'} for e in stored(p)['events']))
    mouse_drag(p,'a','b',after=False);check('reverse drag restores chronological order',order(p)==['a','b','c'])
    before=raw(p);mouse_drag(p,'a','c',cancel=True)
    check('Escape cancels drag without persistence',raw(p)==before and order(p)==['a','b','c'] and p.locator('.sort-ghost').count()==0)
    # Dropping outside the original month must not move or change the month.
    a,_=positions(p,'a','c');p.mouse.move(*a);p.mouse.down();p.mouse.move(20,400,steps=8);p.mouse.up();p.wait_for_timeout(380)
    check('outside-month drop is rejected',raw(p)==before and p.locator('#toast').inner_text()=='只能在同一月份排序')
    # SVG must reflect the same order immediately after dragging in graph view.
    act(p,'view-graph');line=p.locator('.timeline-svg polyline').get_attribute('points')
    mouse_drag(p,'c','a',after=False)
    check('annual graph updates with the reordered cards',order(p)==['c','a','b'] and p.locator('.timeline-svg polyline').get_attribute('points')!=line)
    p2=mount(b,1440,960,{KEY:raw(p)});prepare(p2)
    check('saved order reloads from serialized state',order(p2)==['c','a','b'])
    act(p2,'view-graph');p2.locator('.energy-board').scroll_into_view_if_needed();p2.screenshot(path=str(OUT/'energy-board-desktop.png'))
    # Empty months don't invent events, and scoring new cards has no feelings/order field.
    prepare(p2,8);check('empty month has no fake zero cards',order(p2,8)==[])
    p2.locator('[data-action="add-event"][data-month="8"]').click()
    check('new scoring card also omits feelings and order fields',p2.locator('#editor [name="order"],#editor [name="feelings"],#editor [name="customFeelings"]').count()==0)
    p2.locator('[name="title"]').fill('新事件');p2.locator('[name="energy"]').fill('5');save(p2)
    check('new scoring card gets a valid automatic order',order(p2,8) and any(e['title']=='新事件' and e['order']==1 and e['energy']==5 for e in stored(p2)['events']))
    # Touch gestures on a phone-size viewport use the browser's native pointer path.
    mobile=mount(b,390,844,snap);mobile.on('pageerror',lambda e:errors.append(str(e)));prepare(mobile,2)
    start,end=positions(mobile,'d','e');cdp=mobile.context.new_cdp_session(mobile)
    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':start[0],'y':start[1]}]})
    for i in range(1,13):
      x=start[0]+(end[0]-start[0])*i/12;y=start[1]+(end[1]-start[1])*i/12
      cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x,'y':y}]})
    cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});mobile.wait_for_timeout(380)
    check('phone touch drag commits month order',order(mobile,2)==['e','d'])
    check('touch handling is confined to the grip',mobile.locator('[data-reorder-handle]').first.evaluate('e=>getComputedStyle(e).touchAction')=='none' and mobile.locator('[data-sort-id]').first.evaluate('e=>getComputedStyle(e).touchAction')!='none')
    # Pointer cancellation (OS gesture, phone interruption) is a no-op.
    before=raw(mobile);start,end=positions(mobile,'e','d')
    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':start[0],'y':start[1]}]})
    cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':end[0],'y':end[1]}]})
    cdp.send('Input.dispatchTouchEvent',{'type':'touchCancel','touchPoints':[]});mobile.wait_for_timeout(380)
    check('phone pointer cancellation preserves data',raw(mobile)==before and mobile.locator('.sort-ghost').count()==0)
    mobile.evaluate('window.scrollTo(0,0)');mobile.screenshot(path=str(OUT/'energy-board-mobile.png'),full_page=True)
    mobile.locator('[data-sort-id="d"] [data-action="edit-event"]').click();mobile.screenshot(path=str(OUT/'energy-score-mobile.png'))
    # Viewport fits and legacy private labels never leak into handles or drag previews.
    for width,height in [(320,568),(390,844),(768,1024),(1024,768),(1440,960)]:
      q=mount(b,width,height,snap);prepare(q)
      check(f'board and scoring fit {width}px',not q.evaluate('document.documentElement.scrollWidth>innerWidth+1'))
      q.locator('[data-sort-id="a"] [data-action="edit-event"]').click()
      check(f'no emotion inputs and score visible at {width}px',q.locator('#editor [name="feelings"]').count()==0 and q.locator('#event-energy').is_visible() and q.locator('#editor').evaluate('e=>e.scrollWidth<=e.clientWidth+1'))
      q.close()
    secret=fixture();secret['events'][0].update(private=True,title='不可洩漏的測試文字');private=mount(b,1440,960,{KEY:json.dumps(secret)});prepare(private)
    check('masked names are used in all sort accessible labels','不可洩漏的測試文字' not in private.locator('#main').inner_text() and '不可洩漏的測試文字' not in private.locator('[data-sort-id="a"]').inner_html())
    a,z=positions(private,'a','b');private.mouse.move(*a);private.mouse.down();private.mouse.move(*z,steps=6)
    check('drag ghost respects private masking','不可洩漏的測試文字' not in private.locator('.sort-ghost').inner_text())
    private.keyboard.press('Escape');private.mouse.up()
    # Failure paths use existing commit safeguards; a failed write retains local changes.
    quota=mount(b,1440,960,snap);prepare(quota);quota.evaluate('window.__storageFail=true')
    quota.locator('[data-id="a"][data-month-move="1"]').click()
    check('quota failure is visible and does not erase stored data',raw(quota)==snap[KEY] and order(quota)==['b','a','c'] and '尚未儲存' in quota.locator('.save-status').inner_text())
    conflict=mount(b,1440,960,snap);prepare(conflict);external=fixture();external['revision']+=1
    conflict.evaluate('([k,v])=>window.__storageData[k]=v',[KEY,json.dumps(external)])
    conflict.locator('[data-id="a"][data-month-move="1"]').click()
    check('cross-tab write is not overwritten by reorder',stored(conflict)==external and '尚未儲存' in conflict.locator('.save-status').inner_text())
    guide=mount(b,1440,960,snap);guide.set_default_timeout(5000);act(guide,'start-guide');prepare(guide,6)
    guide.locator('[data-id="demo-event-5"][data-month-move="-1"]').click()
    check('guided month sorting never writes personal storage',order(guide,6)==['demo-event-5','guide-june-work'] and raw(guide)==snap[KEY])
    check('no uncaught JavaScript errors',not errors)
    (OUT/'energy-board-checks.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'environment':'Chromium; native mouse/CDP touch input; explicit Storage shim'},ensure_ascii=False,indent=2))
    for context in b.contexts: context.close()
    b.close()
if __name__=='__main__':run()
