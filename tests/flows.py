"""UI integration checks using the documented deterministic Storage shim.
Run after npm run build. Does not validate native storage persistence or Safari.
"""
from smoke import mount, OUT
from playwright.sync_api import sync_playwright
import json, os, xml.etree.ElementTree as ET
KEY='life-atlas.v1.personal'
checks=[]
def check(name, value=True):
    assert value,name
    checks.append(name); print('PASS',name)
def action(p,name): p.locator(f'[data-action="{name}"]').first.click()
def step(p,n): p.locator(f'.steps [data-step="{n}"]').click()
def fill(p,n,v): p.locator(f'#editor [name="{n}"]').fill(str(v))
def select(p,n,v): p.locator(f'#editor select[name="{n}"]').select_option(v)
def save(p):
    p.locator('#editor button[type="submit"]').click()
    p.wait_for_function('!document.querySelector("#editor").open')
def stored(p): return json.loads(p.evaluate('(key)=>localStorage.getItem(key)',KEY))
def snap(p): return p.evaluate('({...window.__storageData})')
def import_file(p,content):
    action(p,'data')
    with p.expect_file_chooser() as f: action(p,'import')
    f.value.set_files({'name':'backup.json','mimeType':'application/json','buffer':content.encode()})
def run():
  with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    p=mount(b); errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
    # Actual interactions, no injected application state.
    step(p,1);action(p,'add-event');fill(p,'title','<img src=x onerror=alert(1)>');fill(p,'facts','只有事實，先不評價');p.locator('[name="private"]').check();save(p)
    s=stored(p); eid=s['events'][0]['id']
    check('facts saved without inventing zero energy',s['events'][0]['energy'] is None)
    check('user HTML displayed as text',p.locator('img').count()==0)
    for title in ('朋友邀約','小小旅行'):
        p.locator('[data-action="add-event"][data-month="1"]').click();fill(p,'title',title);save(p)
    check('monthly capacity blocks fourth card',p.locator('[data-action="add-event"][data-month="1"]').count()==0)
    action(p,'add-background');fill(p,'title','每週散步');save(p)
    check('daily background separate from monthly capacity',len(stored(p)['events'])==4)
    step(p,2);p.locator(f'[data-action="edit-event"][data-id="{eid}"]').first.click()
    p.locator('[name="unrated"]').uncheck();p.locator('[name="energy"]').fill('7');save(p)
    check('energy and private marker saved',stored(p)['events'][0]['energy']==7 and stored(p)['events'][0]['private'])
    check('private title masked by default','<img src=x' not in p.locator('#app').inner_text())
    # Bottom-up grouping uses the board; direction is a separate next-step choice.
    step(p,3)
    p.locator('[data-action="d-mode"][data-mode="group"]').click()
    # List accessibility regression; desktop canvas is tested in canvas.py.
    p.locator('[data-action="d-surface"][data-surface="task"]').click()
    for e in stored(p)['events'][:2]: p.locator(f'[data-discovery-select="{e["id"]}"]').check()
    action(p,'d-group-selected')
    p.locator('[data-discovery-form="name"] input').fill('我需要連結')
    p.locator('[data-discovery-form="name"] button').click()
    action(p,'d-options')
    p.locator('#discovery-direction-input').fill('以不耗損的方式與人相處')
    p.locator('[data-discovery-form="direction"] button[type="submit"]').click()
    check('grouping retains two event relations',len(stored(p)['themes'][0]['eventIds'])==2)
    # options: qualitatively different routes + real costs
    step(p,4)
    for title,kind,hours in [('每週安排聚會','add',5),('減少應酬，留一個空白晚上','less',2)]:
        action(p,'add-route');fill(p,'title',title);select(p,'kind',kind);select(p,'themeId',stored(p)['themes'][0]['id']);fill(p,'hours',hours);fill(p,'firstStep','先安排一個晚上');fill(p,'obstacle','突然加班');save(p)
    rid=stored(p)['routes'][0]['id']
    p.locator(f'[data-action="select-route"][data-id="{rid}"]').click();fill(p,'reason','先試試主動邀請');save(p)
    p.locator('#stress-toggle').check()
    check('half-time stress does not alter stored capacity',stored(p)['budget']['hours']==6)
    check('unselected alternative retained',len(stored(p)['routes'])==2 and sum(x['selected'] for x in stored(p)['routes'])==1)
    p.locator(f'[data-action="route-plan"][data-id="{rid}"]').click();fill(p,'title','週末與朋友見面');fill(p,'target',1);fill(p,'acceptance','完成一次自在的相處');fill(p,'trigger','每週三晚餐後發出邀請');fill(p,'minimum','先傳一則訊息');fill(p,'fallback','加班就改到隔天');select(p,'status','active');save(p)
    aid=stored(p)['nodes'][0]['id']
    check('selected option becomes linked experiment',stored(p)['nodes'][0]['routeId']==rid and p.locator('.step.active').get_attribute('data-step')=='5')
    p.locator(f'[data-node-select="{aid}"]').check();action(p,'group-actions');fill(p,'title','維持舒服的人際連結');save(p)
    oid=[x for x in stored(p)['nodes'] if x['type']=='objective'][0]['id']
    check('bottom-up action grouping preserves action id',stored(p)['nodes'][0]['id']==aid and stored(p)['nodes'][0]['parentId']==oid)
    p.locator(f'[data-action="child-result"][data-id="{oid}"]').click();fill(p,'title','對自己的界線更有把握');fill(p,'target',7);fill(p,'unit','分');save(p)
    check('top-down result defaults to latest snapshot',[n for n in stored(p)['nodes'] if n['type']=='result'][0]['aggregation']=='latest')
    # full, minimum, reflection and stop decisions
    step(p,6)
    for mode,amount,decision in [('full',1,'keep'),('minimum',1,'keep'),('reflection',0,'pause')]:
        p.locator(f'[data-action="log-node"][data-id="{aid}"]').click();select(p,'mode',mode)
        if mode!='reflection': fill(p,'amount',amount)
        select(p,'direction','drains' if mode=='reflection' else 'supports');select(p,'decision',decision);fill(p,'note','我在辨識什麼適合自己');save(p)
    check('three feedback modes retained separately',len(stored(p)['reviews'])==3)
    check('pause feedback updates experiment status',[n for n in stored(p)['nodes'] if n['id']==aid][0]['status']=='paused')
    step(p,4);p.locator(f'[data-action="select-route"][data-id="{rid}"]').click()
    check('unselecting route does not delete experiments',len(stored(p)['nodes'])==3)
    snapshot=snap(p)
    p2=mount(b,390,844,snapshot)
    check('serialized state reloads in fresh UI',len(stored(p2)['reviews'])==3)
    step(p2,5);p2.locator(f'[data-action="edit-node"][data-id="{aid}"]').click();p2.keyboard.press('Escape')
    check('mobile native dialog closes with Escape',not p2.locator('#editor').evaluate('(d)=>d.open'))
    # Preserve original on invalid import, require explicit replacement on valid import.
    before=snap(p2)[KEY]
    import_file(p2,'{"version":999}');p2.wait_for_timeout(100)
    check('invalid import leaves exact stored bytes unchanged',snap(p2)[KEY]==before)
    action(p2,'close-dialog');replacement=json.loads(before);replacement['year']=2024
    import_file(p2,json.dumps(replacement));p2.wait_for_selector('[data-form="import-confirm"]')
    check('valid import is not written before confirmation',snap(p2)[KEY]==before)
    save(p2);check('confirmed replacement retains previous snapshot',stored(p2)['year']==2024 and snap(p2)[KEY+'.previous']==before)
    # Capture generated Blob bytes without navigation.
    p2.evaluate('''() => { window.__exports=[];const original=URL.createObjectURL;URL.createObjectURL=(blob)=>{window.__exports.push(blob);return original(blob)};document.addEventListener('click',e=>{if(e.target.closest('a[download]'))e.preventDefault()},true) }''')
    action(p2,'data');action(p2,'export-json')
    exported=p2.evaluate('async()=>await window.__exports.at(-1).text()')
    check('JSON backup includes private data',json.loads(exported)['events'][0]['private'])
    action(p2,'export-map');save(p2)
    svg=p2.evaluate('async()=>await window.__exports.at(-1).text()');ET.fromstring(svg)
    check('SVG is well-formed and excludes private event title','onerror=alert' not in svg and '<svg' in svg)
    # Quota failure preserves in-memory progress, warns, does not overwrite raw snapshot.
    quota=mount(b,storage=snapshot);quota.evaluate('window.__storageFail=true');step(quota,5);action(quota,'decision');fill(quota,'note','這週先休息');save(quota)
    check('quota failure is visible and original remains',snap(quota)[KEY]==snapshot[KEY] and '尚未儲存' in quota.locator('.save-status').inner_text())
    # A simultaneous external write cannot silently be overwritten.
    conflict=mount(b,storage=snapshot);external=json.loads(snapshot[KEY]);external['revision']+=1;external['year']=2023
    conflict.evaluate('([k,v])=>window.__storageData[k]=v',[KEY,json.dumps(external)]);step(conflict,5);action(conflict,'decision');fill(conflict,'note','本頁的新理解');save(conflict)
    check('conflicting tab write pauses persistence',stored(conflict)['year']==2023 and '另一個分頁' in conflict.locator('#app').inner_text())
    # Invalid existing storage enters recovery and is not replaced with a blank state.
    corrupt=mount(b,storage={KEY:'not-json'})
    check('corrupted storage is preserved for recovery',snap(corrupt)[KEY]=='not-json' and '先保護原本的紀錄' in corrupt.locator('#app').inner_text())
    # Demonstration is a separate workspace, not inserted into personal data.
    separate=mount(b,storage=snapshot);action(separate,'start-guide')
    check('demo switch preserves personal backup',snap(separate)[KEY]==snapshot[KEY])
    check('no uncaught JavaScript exceptions',not errors)
    (OUT/'ui-checks.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'storage':'deterministic shim, not native origin storage'},ensure_ascii=False,indent=2))
    b.close()
if __name__=='__main__':run()
