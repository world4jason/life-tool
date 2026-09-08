"""Discovery regression on local bundled bytes + explicit Storage shim.
No network navigation, native persistence or physical Safari claims.
"""
from smoke import mount, OUT
from playwright.sync_api import sync_playwright
import json, os, subprocess
KEY='life-atlas.v1.personal'
checks=[]
def check(name, value):
    assert value,name
    checks.append(name);print('PASS',name,flush=True)
def state(p):return json.loads(p.evaluate('(k)=>localStorage.getItem(k)',KEY))
def step(p,n):p.locator(f'.steps [data-step="{n}"]').click()
def click(p,name):p.locator(f'[data-action="{name}"]').first.click()
def submit(p):p.locator('#editor button[type="submit"]').click()
def make_fixture():
    return json.loads(subprocess.check_output(['node','--input-type=module','-e',"""
import { demoState } from './src/domain.mjs';
const s=demoState();s.version=1;for(const t of s.themes){delete t.method;delete t.unrelatedEventIds;}
s.events[0].private=true;s.events[0].title='測試私密名稱';
console.log(JSON.stringify(s));
"""],text=True))
def drag_mouse(p, grip, target):
    grip.scroll_into_view_if_needed();start=grip.bounding_box();target.scroll_into_view_if_needed();end=target.bounding_box()
    # Re-measure after any target scrolling.
    start=grip.bounding_box()
    p.mouse.move(start['x']+start['width']/2,start['y']+start['height']/2);p.mouse.down()
    p.mouse.move(end['x']+end['width']/2,end['y']+min(70,end['height']/2),steps=12);p.wait_for_timeout(80);p.mouse.up()
def run():
  with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    errors=[];old=make_fixture();raw=json.dumps(old,ensure_ascii=False);original={KEY:raw}
    p=mount(b,storage=original);p.on('pageerror',lambda e:errors.append(str(e)))
    step(p,3)
    check('no write occurs merely by opening migrated data',p.evaluate('(k)=>localStorage.getItem(k)',KEY)==raw)
    check('two distinct methods and inline actionable instructions',p.locator('[data-action="d-mode"]').count()==2 and p.locator('.discovery-instruction').count()==1)
    check('old planning and emotion fields absent from discovery',p.locator('#main [name="feelings"],#main [name="intention"],#main [name="value"],#main [name="counterExample"]').count()==0)
    check('new-word view gives an editable term and examples',p.locator('#discovery-word').is_editable() and p.locator('.discovery-suggestions button').count()==6)
    p.locator('#discovery-word').fill('自由');p.locator('[data-discovery-form="word"] button[type="submit"]').click()
    s=state(p);term=s['themes'][-1];tid=term['id']
    check('first write upgrades schema and preserves original v1 snapshot',s['version']==2 and p.evaluate('(k)=>localStorage.getItem(k+".before-v2")',KEY)==raw)
    check('legacy unselected events are not marked unrelated',all(t['method']=='legacy' and not t['unrelatedEventIds'] for t in s['themes'][:-1]))
    check('new word has no direction or pre-decided cards',term['intention']=='' and term['eventIds']==[] and term['unrelatedEventIds']==[])
    check('private title and facts masked on discovery cards','測試私密名稱' not in p.locator('#main').inner_text())
    click(p,'d-later')
    check('skip leaves all cards pending',state(p)['themes'][-1]['eventIds']==[] and state(p)['themes'][-1]['unrelatedEventIds']==[])
    current=p.locator('.discovery-focus [data-discovery-card]').get_attribute('data-discovery-card')
    p.locator('.discovery-answer-buttons [data-answer="related"]').click()
    check('answer classifies only the current card',state(p)['themes'][-1]['eventIds']==[current] and state(p)['themes'][-1]['unrelatedEventIds']==[])
    check('next event is presented automatically',p.locator('.discovery-focus [data-discovery-card]').get_attribute('data-discovery-card')!=current)
    p.locator('.discovery-bin.related [data-action="d-inspect"]').first.click()
    p.locator('.discovery-answer-buttons [data-answer="unrelated"]').click()
    check('reclassification moves between lists without duplication',state(p)['themes'][-1]['eventIds']==[] and state(p)['themes'][-1]['unrelatedEventIds']==[current])
    click(p,'d-undo')
    check('undo restores previous classification',state(p)['themes'][-1]['eventIds']==[current] and state(p)['themes'][-1]['unrelatedEventIds']==[])
    snapshot=state(p)
    drag_mouse(p,p.locator('.discovery-focus [data-discovery-grip]'),p.locator('.discovery-bin.unrelated'))
    check('mouse drag drops into unrelated bin',len(state(p)['themes'][-1]['unrelatedEventIds'])==1)
    p.wait_for_timeout(520)
    before_cancel=state(p);grip=p.locator('.discovery-focus [data-discovery-grip]');grip.scroll_into_view_if_needed();rect=grip.bounding_box()
    p.mouse.move(rect['x']+20,rect['y']+20);p.mouse.down();p.mouse.move(rect['x']+50,rect['y']+70,steps=5);p.keyboard.press('Escape');p.mouse.up()
    check('Escape cancels drag without writing',state(p)==before_cancel)
    # A second term starts a separate classification, even for the same events.
    click(p,'d-new-word');p.locator('#discovery-word').fill('陪伴');p.locator('[data-discovery-form="word"] button').click()
    check('new term does not reuse first term decisions',not state(p)['themes'][-1]['eventIds'] and not state(p)['themes'][-1]['unrelatedEventIds'])
    p.locator(f'[data-action="d-select-word"][data-id="{tid}"]').click()
    saved_term=next(t for t in state(p)['themes'] if t['id']==tid)
    check('return to a term restores its decisions',len(saved_term['eventIds'])==1 and len(saved_term['unrelatedEventIds'])==1)
    click(p,'d-rename');p.locator('[data-discovery-form="name"] input').fill('自主');p.locator('[data-discovery-form="name"] button').click()
    check('rename does not rewrite downstream work',state(p)['routes']==old['routes'] and state(p)['nodes']==old['nodes'])
    # Group mode must not treat binary memberships as group assignments.
    p.locator('[data-action="d-mode"][data-mode="group"]').click()
    check('binary answers are isolated from grouping',p.locator('.discovery-group').count()==len(old['themes']) and p.locator('.discovery-binary-board').count()==0)
    remaining=p.locator('[data-discovery-select]');ids=[remaining.nth(i).get_attribute('data-discovery-select') for i in range(2)]
    for id in ids:p.locator(f'[data-discovery-select="{id}"]').check()
    click(p,'d-group-selected');group=state(p)['themes'][-1];gid=group['id']
    check('group creation precedes naming and includes selected events',group['label']=='' and group['eventIds']==ids and group['unrelatedEventIds']==[])
    check('naming instruction and input receive focus',p.evaluate('document.activeElement.id')=='discovery-name-'+gid and '共同點' in p.locator('.discovery-instruction').inner_text())
    p.locator(f'#discovery-name-{gid}').fill('陪伴');p.locator(f'[data-discovery-form="name"][data-id="{gid}"] button').click()
    check('group has no automatic future direction',state(p)['themes'][-1]['label']=='陪伴' and state(p)['themes'][-1]['intention']=='')
    # Keyboard/touch alternative to dragging.
    member=p.locator(f'[data-discovery-drop="{gid}"] [data-action="d-move-menu"]').first
    member.focus();p.keyboard.press('Enter')
    oldgroup=old['themes'][0]['id'];p.locator(f'#editor [data-action="d-move-to"][data-target="{oldgroup}"]').click()
    check('keyboard-accessible menu moves card between groups',len(next(t for t in state(p)['themes'] if t['id']==gid)['eventIds'])==1)
    click(p,'d-undo')
    check('group move undo preserves all source memberships',next(t for t in state(p)['themes'] if t['id']==gid)['eventIds']==ids)
    # Copy preserves membership rather than moving silently.
    p.locator(f'[data-discovery-drop="{gid}"] [data-action="d-move-menu"]').first.click();p.locator('#discovery-copy').check()
    p.locator(f'#editor [data-action="d-move-to"][data-target="{oldgroup}"]').click()
    check('explicit copy retains source group',next(t for t in state(p)['themes'] if t['id']==gid)['eventIds']==ids)
    p.locator(f'[data-discovery-drop="{gid}"] [data-action="d-options"]').click()
    check('future direction appears only in next chapter',p.locator('.step.active').get_attribute('data-step')=='4' and p.locator('#discovery-direction-input').input_value()=='')
    p.locator('#discovery-direction-input').fill('每週保留和家人相處的時間');p.locator('[data-discovery-form="direction"] button[type="submit"]').click()
    check('setting direction leaves existing route and action contents unchanged',state(p)['routes']==old['routes'] and state(p)['nodes']==old['nodes'])
    p.locator('.discovery-direction [data-action="add-route"]').click();p.locator('#editor [name="title"]').fill('週末一起散步');submit(p)
    route=state(p)['routes'][-1]
    check('new route links to chosen group',route['themeId']==gid)
    p.locator(f'[data-action="select-route"][data-id="{route["id"]}"]').click();p.locator('#editor [name="reason"]').fill('能一起聊天');submit(p)
    p.locator(f'[data-action="route-plan"][data-id="{route["id"]}"]').click();p.locator('#editor [name="title"]').fill('每週一起走路');submit(p)
    node=state(p)['nodes'][-1]
    check('experiment retains theme and route links',node['themeIds']==[gid] and node['routeId']==route['id'])
    step(p,6);p.locator(f'[data-action="log-node"][data-id="{node["id"]}"]').click();p.locator('#editor [name="note"]').fill('有時間聊天');submit(p)
    check('review stays linked to the action',state(p)['reviews'][-1]['nodeId']==node['id'])
    stored_bytes=p.evaluate('(k)=>localStorage.getItem(k)',KEY)
    q=mount(b,storage={KEY:stored_bytes});step(q,3)
    check('classification and groups survive serialized reload',state(q)['themes']==state(p)['themes'])
    # Contextual practice starts here, not at the first chapter, and restores data.
    click(q,'d-practice');check('contextual demo begins in discovery',q.locator('.step.active').get_attribute('data-step')=='3')
    q.locator('.discovery-answer-buttons [data-answer="related"]').click();q.locator('[data-action="d-mode"][data-mode="group"]').click()
    check('group tutorial gives concrete example cards',q.locator('.discovery-suggested').count()==2 and '旅行' in q.locator('.discovery-instruction').inner_text())
    click(q,'guide-exit');check('exiting tutorial restores exact personal bytes',q.evaluate('(k)=>localStorage.getItem(k)',KEY)==stored_bytes)
    # Native touch input events are emulated; this is not physical iOS validation.
    m=mount(b,390,844,original);step(m,3);click(m,'d-practice')
    m.locator('.discovery-focus').scroll_into_view_if_needed()
    before=m.locator('.discovery-word-heading p').inner_text()
    session=m.context.new_cdp_session(m)
    handle=m.locator('.discovery-focus [data-discovery-grip]');dest=m.locator('.discovery-bin.related')
    handle.scroll_into_view_if_needed();h=handle.bounding_box();d=dest.bounding_box()
    # Touch-drag within one viewport; scroll to put both handle and destination in view.
    m.evaluate('window.scrollTo(0, document.querySelector(".discovery-focus").getBoundingClientRect().top+scrollY-20)')
    h=handle.bounding_box();d=dest.bounding_box()
    sx=h['x']+h['width']/2;sy=h['y']+h['height']/2;tx=d['x']+d['width']/2;ty=d['y']+35
    session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':sx,'y':sy}]})
    for i in range(1,11):session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':sx+(tx-sx)*i/10,'y':sy+(ty-sy)*i/10}]})
    session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    check('emulated touch drag classifies an event',m.locator('.discovery-word-heading p').inner_text()!=before)
    # Screenshot all modes and validate long content at five widths.
    layout=mount(b,storage={KEY:stored_bytes});step(layout,3)
    layout_checks=0
    for width,height in [(320,640),(390,844),(768,1024),(1024,900),(1440,1050)]:
      layout.set_viewport_size({'width':width,'height':height})
      for mode in ['binary','group']:
        layout.locator(f'[data-action="d-mode"][data-mode="{mode}"]').click()
        assert not layout.evaluate('document.documentElement.scrollWidth>innerWidth+1'),(width,mode)
        layout_checks+=1
        if width in [390,1440]:layout.screenshot(path=str(OUT/f'discovery-{mode}-{width}.png'),full_page=True)
    check('two methods fit five viewport widths',layout_checks==10)
    step(layout,2);check('removed observation block stays absent',layout.locator('.reflection-prompt,[data-action="reflection"]').count()==0)
    check('no uncaught JS errors',not errors)
    (OUT/'discovery-checks.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'layoutPairs':layout_checks,'storage':'deterministic shim','touch':'Chromium CDP emulation, not physical device'},ensure_ascii=False,indent=2))
    b.close()
if __name__=='__main__':run()
