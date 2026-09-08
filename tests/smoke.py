"""Browser smoke test on the exact standalone build.

The execution sandbox blocks browser navigation. set_content loads only the local
build, with a deterministic Storage shim; it does not bypass network policy.
Real browser localStorage/file-origin persistence is a separate manual check.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import os, json
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'test-results'; OUT.mkdir(exist_ok=True)
HTML=(ROOT/'dist/index.html').read_text()
STORAGE_SCRIPT='''(data) => {
  window.__storageData = {...data}; window.__storageFail = false;
  Object.defineProperty(window, 'localStorage', {configurable: true, value: {
    getItem(key) { return Object.hasOwn(window.__storageData,key) ? window.__storageData[key] : null; },
    setItem(key,value) { if(window.__storageFail) throw new DOMException('quota','QuotaExceededError'); window.__storageData[key] = String(value); },
    removeItem(key) { delete window.__storageData[key]; },
    clear() { window.__storageData={}; }
  }});
}'''
def mount(browser,width=1440,height=1050,storage=None):
    page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1,is_mobile=width<650,has_touch=width<650,timezone_id='Asia/Taipei')
    page.evaluate(STORAGE_SCRIPT,storage or {})
    page.set_content(HTML,wait_until='load')
    page.wait_for_selector('h1')
    return page

def run():
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
        errors=[]
        page=mount(browser)
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.screenshot(path=str(OUT/'desktop-home.png'),full_page=True)
        page.get_by_role('button',name='先玩一輪示範').click()
        page.locator('.steps [data-step="2"]').click()
        page.screenshot(path=str(OUT/'desktop-timeline.png'),full_page=True)
        for width in (1440,1024,768,390,320):
            page.set_viewport_size({'width':width,'height':844 if width<650 else 1050})
            for step in range(7):
                page.locator(f'.steps [data-step="{step}"]').click()
                assert page.locator('h1').count()==1,(width,step,errors)
                overflow=page.evaluate('document.documentElement.scrollWidth > innerWidth + 1')
                print('viewport',width,'chapter',step,'overflow',overflow)
                assert not overflow,(width,step)
                if width==390 and step in (0,2,4,5): page.screenshot(path=str(OUT/f'mobile-{step}.png'),full_page=True)
                if width==1440 and step in (3,4,5,6): page.screenshot(path=str(OUT/f'desktop-{step}.png'),full_page=True)
        print('JS errors',errors); assert not errors
        browser.close()
if __name__=='__main__': run()
