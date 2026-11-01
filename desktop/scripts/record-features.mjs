import {_electron as electron,chromium,expect} from '@playwright/test';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
const require=createRequire(import.meta.url),{Store}=require('../electron/store.cjs');
const rawSource=JSON.parse(readFileSync(process.env.DEMO_SOURCE||'/tmp/local-canvas-v050-demo-source.json'));
const source=rawSource.data || rawSource;
const art=source.elements.filter(e=>!e.isDeleted), out='/tmp/local-canvas-v050-gif-frames';mkdirSync(out,{recursive:true});
const bounds=es=>[Math.min(...es.map(e=>e.x)),Math.min(...es.map(e=>e.y)),Math.max(...es.map(e=>e.x+e.width)),Math.max(...es.map(e=>e.y+e.height))];
const total=bounds(art),zoom=Math.min(850/(total[2]-total[0]),700/(total[3]-total[1]));
const view={zoom:{value:zoom},scrollX:950/2/zoom-(total[0]+total[2])/2,scrollY:850/2/zoom-(total[1]+total[3])/2};
const regions=[['GitHub',[80,180,460,550]],['Search',[520,190,950,630]],['Docker',[1150,170,1850,650]],['Cube',[100,680,500,1100]],['Security',[500,660,980,1100]],['Python',[1180,690,1820,1100]]];
const scenes=regions.map(([title,[x,y,x2,y2]],i)=>({id:'demo-scene-'+i,title,rect:{x,y,width:x2-x,height:y2-y}}));
const libraryItems=regions.map(([name,[x,y,x2,y2]],i)=>({id:'demo-asset-'+i,name,status:'published',created:1,elements:art.filter(e=>{const cx=e.x+e.width/2,cy=e.y+e.height/2;return cx>=x&&cx<x2&&cy>=y&&cy<y2;})})).filter(i=>i.elements.length);
let app,p,profile,frames,caption,frameCount,webServer,demoView=view,demoZoom=zoom;
const manifest=[];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const btn=(name)=>p.getByRole('button',{name,exact:true});
async function init(options={}){
 profile=mkdtempSync('/tmp/canvas-feature-demo-');const db=new Store(join(profile,'workspace.sqlite'));
 const data={...source,elements:structuredClone(art),appState:{...source.appState,...view},scenes:options.scenes?structuredClone(scenes):[],libraryItems:options.library?structuredClone(libraryItems):[]};
 if(options.embedded){
  const base=art.find(e=>e.type==='rectangle');
  const embed={...base,id:'demo-separate-embed',type:'embeddable',x:total[2]+180,y:total[1]+120,width:850,height:480,angle:0,groupIds:[],boundElements:null,containerId:null,frameId:null,link:options.embedded,index:null,backgroundColor:'transparent'};
  data.elements.push(embed);
  const all={x:total[0]-60,y:total[1]-60,width:embed.x+embed.width-total[0]+120,height:Math.max(total[3],embed.y+embed.height)-total[1]+120};
  data.scenes=[{id:'demo-all',title:'模板与独立视频区',rect:all},{id:'demo-detail',title:'独立播放区',rect:{x:embed.x-80,y:embed.y-80,width:embed.width+160,height:embed.height+160}},{id:'demo-art',title:'返回原始模板',rect:{x:total[0]-40,y:total[1]-40,width:total[2]-total[0]+80,height:total[3]-total[1]+80}}];
 }
 if(options.template){
  data.elements=structuredClone(libraryItems.find(i=>i.name===options.template).elements);
  const b=bounds(data.elements),z=Math.min(560/(b[2]-b[0]),620/(b[3]-b[1]));
  data.appState={...data.appState,zoom:{value:z},scrollX:570/z-(b[0]+b[2])/2,scrollY:440/z-(b[1]+b[3])/2};
 }
 demoView=data.appState;demoZoom=demoView.zoom.value;
 const id=db.create('document',null,'new',data);db.db.prepare('DELETE FROM nodes WHERE id<>?').run(id);db.setSetting('activeDocument',id);db.setSetting('appPreferences',JSON.stringify({autoCheckUpdates:false,language:'zh-CN'}));db.close();
 if(options.web){const {startServer}=require('../web/server.cjs');webServer=startServer({directory:profile,username:'demo',password:'demo-password-123456',port:0});await new Promise(r=>webServer.once('listening',r));app=await chromium.launch({channel:'chrome',headless:true});const context=await app.newContext({httpCredentials:{username:'demo',password:'demo-password-123456'},viewport:{width:1440,height:960}});p=await context.newPage();await p.goto('http://127.0.0.1:'+webServer.address().port);await expect(p.locator('.excalidraw')).toBeVisible();return;}
 app=await electron.launch({args:[process.cwd()],env:{...process.env,LOCAL_CANVAS_DATA:profile}});
 p=await app.firstWindow();await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setBounds({x:0,y:0,width:1440,height:960}));p.setDefaultTimeout(7000);await expect(p.locator('.excalidraw')).toBeVisible();await wait(500);
 await app.evaluate(({dialog},dir)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:dir+'/new.canvas.json'});},profile);
 if(options.template){await btn('隐藏文件栏').click();await btn('隐藏场景').click();await p.locator('.canvas canvas.interactive').click({button:'middle',clickCount:2,position:{x:720,y:400},delay:100});await p.locator('.canvas canvas.interactive').click({button:'right',position:{x:720,y:400}});await p.mouse.move(720,494);await p.keyboard.down('Control');for(let i=0;i<3;i++){await p.mouse.wheel(0,120);await wait(120);}await p.keyboard.up('Control');await p.keyboard.press('Meta+s');await wait(300);const d=await p.evaluate(async()=>{const b=window.workspace;return(await b.invoke('read',await b.invoke('getSetting','activeDocument'))).data.appState;});demoView=d;demoZoom=d.zoom.value;}
 if(options.embedded){await btn('允许加载').click();await btn('隐藏文件栏').click();await btn('隐藏场景').click();await p.locator('.canvas canvas.interactive').click({button:'middle',clickCount:2,position:{x:700,y:350},delay:100});await p.locator('.canvas canvas.interactive').click({button:'right',position:{x:700,y:350}});await p.keyboard.press('Alt+z');await wait(1200);}

}
async function label(text){await p.evaluate(text=>{let n=document.getElementById('demo-caption');if(!n){n=document.createElement('div');n.id='demo-caption';n.style.cssText='position:fixed;bottom:60px;left:50%;transform:translateX(-50%);max-width:72vw;padding:7px 15px;border-radius:7px;background:#172b4dee;color:white;font:14px/20px system-ui;z-index:99999;pointer-events:none;box-shadow:0 2px 8px #0002';document.body.append(n);}n.textContent=text;},text);}
async function step(text,fn){await label(text);await wait(320);await fn();await wait(700);}
async function snap(){const filename=join(frames,String(frameCount++).padStart(4,'0')+'.png');await p.screenshot({path:filename,scale:'css'});}
async function clip(name,title,fn,options={}){
 if(process.env.ONLY&&!process.env.ONLY.split(',').includes(name))return;
 await init(options);await p.evaluate(()=>{const c=document.createElement('div');c.id='demo-cursor';c.style.cssText='position:fixed;left:-40px;top:-40px;width:22px;height:22px;border:2px solid #1971c2;border-radius:50%;box-shadow:0 0 0 5px #1971c222;background:#fff5;pointer-events:none;z-index:100000;transform:translate(-50%,-50%);';document.body.append(c);document.addEventListener('pointermove',e=>{c.style.left=e.clientX+'px';c.style.top=e.clientY+'px';},true);document.addEventListener('pointerdown',()=>{c.style.background='#1971c250';c.style.boxShadow='0 0 0 9px #1971c222';},true);document.addEventListener('pointerup',()=>{c.style.background='#fff5';c.style.boxShadow='0 0 0 5px #1971c222';},true);});frames=join(out,name);rmSync(frames,{recursive:true,force:true});mkdirSync(frames,{recursive:true});frameCount=0;
 let running=true,error=null;await label(title);
 const action=(async()=>{await wait(500);await fn();await wait(1000);})().catch(e=>{error=e;}).finally(()=>running=false);
 while(running){await snap();await wait(options.smooth?35:140);}await action;await snap();
 const entry={name,title,frames:frameCount,status:error?'error':'ok',error:error?.message};manifest.push(entry);writeFileSync(join(out,'manifest-'+(process.env.ONLY||'all')+'.json'),JSON.stringify(manifest,null,2));console.log(JSON.stringify(entry));
 await app.close();if(webServer){await new Promise(r=>webServer.close(r));webServer=null;}rmSync(profile,{recursive:true,force:true});if(error&&process.env.FAIL_FAST)throw error;
}
async function point(e,fx=.5,fy=.5){const b=await p.locator('.canvas').boundingBox();return{x:b.x+(e.x+e.width*fx+demoView.scrollX)*demoZoom,y:b.y+(e.y+e.height*fy+demoView.scrollY)*demoZoom};}
async function pick(e,fx=.5,fy=.5){await p.keyboard.press('Escape');const pt=await point(e,fx,fy);await p.keyboard.down('Meta');await p.mouse.click(pt.x,pt.y);await p.keyboard.up('Meta');await wait(200);}
async function pan(dx,dy){const b=await p.locator('.canvas').boundingBox();await p.mouse.move(b.x+b.width*.6,b.y+b.height*.7);await p.mouse.down({button:'middle'});await p.mouse.move(b.x+b.width*.6+dx,b.y+b.height*.7+dy,{steps:18});await p.mouse.up({button:'middle'});}
async function drag(from,to){const a=await from.boundingBox(),b=await to.boundingBox();await p.mouse.move(a.x+a.width/2,a.y+a.height/2);await p.mouse.down();await p.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:20});await p.mouse.up();}
async function tools(){await p.locator('.workspace-tools summary').click();}
async function selectedAll(){await p.locator('.canvas canvas.interactive').click({position:{x:800,y:740}});await p.keyboard.press('Meta+a');}
async function slide(slider,value){const b=await slider.boundingBox();const m=await slider.evaluate(e=>({min:Number(e.min),max:Number(e.max),value:Number(e.value)}));const x=v=>b.x+8+(b.width-16)*(v-m.min)/(m.max-m.min);await p.mouse.move(x(m.value),b.y+b.height/2);for(let i=1;i<=30;i++){const n=Math.round(m.value+(value-m.value)*i/30);await p.mouse.move(x(n),b.y+b.height/2);await slider.fill(String(n));await slider.evaluate((e,n)=>{const b=e.getBoundingClientRect(),c=e.ownerDocument.getElementById('demo-cursor');if(c){c.style.left=(b.x+8+(b.width-16)*(n-Number(e.min))/(Number(e.max)-Number(e.min)))+'px';c.style.top=(b.y+b.height/2)+'px';}},n);await wait(35);}await slider.press('Tab');await wait(300);await expect(slider).toHaveValue(String(value));}

const text=art.find(e=>e.type==='text'&&e.text==='Search'),circle=art.find(e=>e.type==='ellipse'&&e.width>300);
await clip('font-scale','相对字号：原生四档＋滑块＋数字输入',async()=>{
 await pick(text);const s=p.getByRole('slider',{name:'字号比例',exact:true});await expect(s).toBeVisible();
 await step('10–100% 按当前文字比例调整，保留原生四档',async()=>{await slide(s,30);await wait(500);await slide(s,85);});
 await step('数字框支持键盘输入与 Tab；后续文字继承字号',async()=>{const n=p.getByRole('spinbutton',{name:'字号比例数值',exact:true});await n.fill('65');await n.press('Tab');});
},{template:'Search',smooth:true});
await clip('fill-density','填充密度：斜线与交叉线实时调节',async()=>{
 await pick(circle,.5,.08);await p.getByTestId('fill-cross-hatch').click();const s=p.getByRole('slider',{name:'填充密度',exact:true});
 await step('调节交叉填充疏密，尺寸与位置保持',async()=>{await slide(s,25);await wait(500);await slide(s,150);await wait(500);await slide(s,70);});
 await expect.poll(()=>p.evaluate(async()=>{const b=window.workspace;const d=(await b.invoke('read',await b.invoke('getSetting','activeDocument'))).data;return d.elements.find(e=>e.type==='ellipse'&&e.width>300)?.fillStyle;})).toBe('cross-hatch');
},{template:'GitHub',smooth:true});
await clip('arrange','自动整理：纵向 / 横向 / 阵列与等距间隔',async()=>{
 await selectedAll();
 for(const mode of ['vertical','horizontal','grid']){await btn('自动整理').click();await p.getByLabel('整理模式',{exact:true}).selectOption(mode);await step({vertical:'纵向等距整理',horizontal:'横向等距整理',grid:'阵列整理，并一键加入演示列表'}[mode],async()=>{if(mode==='grid')await p.getByRole('checkbox',{name:/整理后添加到演示列表/}).check();await btn('应用整理').click();});
 await p.locator('.canvas canvas.interactive').click({button:'middle',clickCount:2,position:{x:550,y:400}});await wait(500);await p.locator('.canvas canvas.interactive').click({button:'right',position:{x:550,y:400}});await selectedAll();}
});
await clip('balloons','自增球标：连续编号、手动起点与原生样式',async()=>{
 await btn('自增球标').click();const b=await p.locator('.canvas').boundingBox();
 await step('点击放置 1、2、3；沿用原生字体与形状样式',async()=>{for(let i=0;i<3;i++){await p.mouse.click(b.x+160+i*180,b.y+640);await wait(400);}});
 await step('修改下一编号，从 7 继续自增',async()=>{await p.getByLabel('下一球标编号',{exact:true}).fill('7');await p.mouse.click(b.x+700,b.y+640);await p.keyboard.press('Escape');});
});
await clip('search','画布搜索：文字 / 拼音 / 首字母，高亮并定位',async()=>{
 await pick(art.find(e=>e.type==='text'&&e.text.startsWith('security')));await p.keyboard.press('Enter');await p.locator('textarea.excalidraw-wysiwyg').fill('security\nintegration\n安全集成');await p.locator('textarea.excalidraw-wysiwyg').press('Escape');
 const s=p.getByRole('searchbox',{name:/搜索画布|搜索文字|画布搜索/});
 const input=(await s.count())?s:p.locator('.workspace-search-field input').first();
 await step('搜索 Search：文字高亮，结果可直接定位',async()=>{await input.fill('Search');await wait(600);await p.locator('.workspace-search-results button').first().click();});
 await step('中文支持全拼和首字母，英文保持原文检索',async()=>{await input.fill('aqjc');await wait(600);await p.locator('.workspace-search-results button').first().click();});
});
await clip('overview','全览与快速定位：中键双击 → 拖动 → 回到编辑',async()=>{
 await step('双击中键全览所有元素，不受固定最低比例限制',async()=>{await p.locator('.canvas canvas.interactive').click({button:'middle',clickCount:2,position:{x:600,y:350},delay:100});});
 await step('抓手平移到目标位置，再次双击恢复编辑比例',async()=>{await pan(-100,60);await p.locator('.canvas canvas.interactive').click({button:'middle',clickCount:2,position:{x:470,y:300},delay:100});});
 await step('右键可保留全览位置；滚轮缩放连续变化',async()=>{await p.locator('.canvas canvas.interactive').click({button:'middle',clickCount:2,position:{x:600,y:350},delay:100});await p.locator('.canvas canvas.interactive').click({button:'right',position:{x:600,y:350}});await p.keyboard.down('Control');await p.mouse.wheel(0,-120);await p.keyboard.up('Control');});
});
await clip('scenes-create','三种场景：当前视图、框选区域、元素 / 组合',async()=>{
 await step('保存当前视图为场景',()=>btn('添加当前视图为场景').click());
 await step('手动框选局部区域',async()=>{await btn('＋ 框选区域').click();const b=await p.locator('.selection-layer').boundingBox();await p.mouse.move(b.x+70,b.y+160);await p.mouse.down();await p.mouse.move(b.x+320,b.y+400,{steps:20});await p.mouse.up();});
 await step('选中元素或组合：创建自动跟随的场景',async()=>{await pick(circle);await btn('＋ 选择元素').click();});
});
await clip('scenes-list','场景管理：原位标题、拖拽排序、Shift 批量删除',async()=>{
 await step('右键改名，直接在标题中编辑',async()=>{await p.locator('.scene').first().click({button:'right'});await p.getByRole('menuitem',{name:'改名',exact:true}).click();await p.getByLabel('场景标题',{exact:true}).fill('首页 · GitHub');await p.getByLabel('场景标题',{exact:true}).press('Enter');});
 await step('拖拽调整演示顺序',()=>drag(p.locator('.drag-handle').last(),p.locator('.scene').first()));
 await step('Shift 连选；删除前确认，不影响画布元素',async()=>{await p.locator('.scene-target').nth(1).click();await p.keyboard.down('Shift');await p.locator('.scene-target').nth(3).click();await p.keyboard.up('Shift');await p.locator('.scene').nth(1).click({button:'right'});await p.getByRole('menuitem',{name:/删除/}).click();await wait(900);await btn('取消').click();});
},{scenes:true});
await clip('presentation','全屏演示：平滑翻页、自动演示、停留与循环',async()=>{
 await btn('▶ 演示').click();await wait(900);
 await step('从首页进入，手动平滑切换场景',()=>btn('下一场景').click());
 await step('移动时长与停留时长独立设置，自动循环',async()=>{await p.getByLabel('演示移动时长').selectOption('1500');await p.getByLabel('自动演示停留时间').selectOption('1000');await btn('循环演示').click();await btn('自动演示').click();await wait(5200);await btn('暂停自动演示').click();});
 await step('演示图层面板管理场景，退出恢复编辑视图',async()=>{await btn('图层').click();await wait(600);await btn('图层').click();await btn('退出演示').click();});
},{scenes:true});
await clip('presentation-ink','演示临时画笔：原生样式，翻页自动清除',async()=>{
 await btn('▶ 演示').click();await wait(900);await btn('临时画笔').click();
 await step('选择描边、粗细、边框与线条风格',async()=>{const ink=p.locator('.presentation-ink');await ink.getByRole('button',{name:'#e03131',exact:true}).click();await ink.getByRole('group',{name:'线条风格',exact:true}).locator('label').nth(2).click();});
 await step('在演示中书写标注，不写入原白板',async()=>{const b=await p.locator('.presentation-ink').boundingBox();await p.mouse.move(b.x+b.width*.38,b.y+b.height*.45);await p.mouse.down();await p.mouse.move(b.x+b.width*.65,b.y+b.height*.4,{steps:24});await p.mouse.up();});
 await step('切换场景，临时笔迹自动清除',()=>btn('下一场景').click());
},{scenes:true});
await clip('themes-layout','六种主题、可伸缩侧栏与独立隐藏',async()=>{
 for(const t of ['github','reddit','vscode','notion','wechat','discord'])await step(t+' 主题',()=>p.getByLabel('界面主题',{exact:true}).selectOption(t));
 await p.getByLabel('界面主题',{exact:true}).selectOption('github');
 await step('左右侧栏独立隐藏 / 展开',async()=>{await btn('隐藏场景').click();await btn('隐藏文件栏').click();await wait(500);await btn('显示文件栏').click();await btn('显示场景').click();});
});
await clip('workspace','本地文件管理：根目录新建、重命名、移动与排序',async()=>{
 await step('根目录右键创建文件夹',async()=>{await p.locator('.files > .root').click({button:'right'});await p.getByRole('menuitem',{name:'新建文件夹',exact:true}).click();await p.locator('.modal input').fill('演示项目');await btn('确定').click();});
 await step('在文件原位菜单重命名',async()=>{await p.locator('.tree .tree-row').filter({hasText:'new'}).click({button:'right'});await p.getByRole('menuitem',{name:/重命名/}).click();await p.getByLabel('文件名称').fill('new · 功能演示');await btn('保存名称').click();});
 await step('移动到指定文件夹；目录支持自定义、名称和时间排序',async()=>{await p.locator('.tree .tree-row').filter({hasText:'new · 功能演示'}).click({button:'right'});await p.getByRole('menuitem',{name:/移动到文件夹/}).click();await p.getByLabel('移动到文件夹',{exact:true}).selectOption({label:'演示项目'});await btn('移动到此处').click();for(const mode of ['name','created','custom']){await p.getByLabel('目录排序',{exact:true}).selectOption(mode);await wait(450);}});
});
await clip('save-files','保存与另存为：内容自动保存，手动保存同时记录视图',async()=>{
 await step('平移浏览不触发内容保存；Ctrl/Cmd+S 主动保存当前视图',async()=>{await pan(60,30);await p.keyboard.press('Meta+s');});
 await step('另存为选择独立文件位置，原白板保留',()=>btn('另存为').click());
 await step('文件信息显示关联文件和本机恢复副本位置',async()=>{await btn('文件信息').click();await wait(1200);await btn('关闭').click();});
 await step('工作区保存位置可查看并迁移',async()=>{await tools();await btn('保存位置').click();await wait(1200);await btn('关闭').click();});
});
await clip('backup-trash','备份恢复与回收站：误删可恢复，清空需确认',async()=>{
 await tools();await step('完整工作区备份包含文档、场景和素材库',()=>btn('备份工作区').click());
 await app.evaluate(({dialog},dir)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[dir+'/new.canvas.json']});},profile);
 await step('从备份导入新文件夹，不覆盖已有白板',()=>btn('恢复备份').click());
 await step('移入回收站前明确确认',async()=>{await p.locator('.tree .tree-row').filter({hasText:'new'}).first().click({button:'right'});await p.getByRole('menuitem',{name:'移入回收站',exact:true}).click();await p.locator('.file-menu').getByRole('button',{name:'移入回收站',exact:true}).click();});
 await step('在回收站恢复；清空先展示确认',async()=>{await btn('回收站').click();await p.locator('.modal').getByRole('button',{name:'清空回收站',exact:true}).click();await wait(900);await btn('取消清空').click();await btn('恢复').first().click();});
},{scenes:true,library:true});
await clip('scenes-follow','元素场景：移动跟随、解除与重建跟随',async()=>{
 await pick(circle);await btn('＋ 选择元素').click();await step('选中元素创建场景，区域随移动自动更新',async()=>{const pt=await point(circle);await p.mouse.move(pt.x,pt.y);await p.mouse.down();await p.mouse.move(pt.x+100,pt.y+40,{steps:24});await p.mouse.up();});
 await step('右键解除跟随，也可重新绑定当前选择',async()=>{await p.locator('.scene').first().click({button:'right'});await p.getByRole('menuitem',{name:'重框（解除跟随）',exact:true}).click();const b=await p.locator('.selection-layer').boundingBox();await p.mouse.move(b.x+100,b.y+180);await p.mouse.down();await p.mouse.move(b.x+360,b.y+420,{steps:18});await p.mouse.up();await pick(text);await p.locator('.scene').first().click({button:'right'});await p.getByRole('menuitem',{name:'重建跟随',exact:true}).click();});
 await step('删除关联元素时删除跟随场景，可记住不再提示',async()=>{await p.keyboard.press('Backspace');await wait(900);});
});
await clip('exports','集中导出：指定区域 PNG / SVG / PDF，完整文档保留编辑',async()=>{
 await btn('导出').click();await step('整张白板与场景分页均有统一导出入口',async()=>{await wait(800);});
 await step('框选需要的区域，导出 PNG、SVG 或 PDF',async()=>{await btn('框选导出区域').click();const b=await p.locator('.selection-layer').boundingBox();await p.mouse.move(b.x+70,b.y+120);await p.mouse.down();await p.mouse.move(b.x+460,b.y+470,{steps:24});await p.mouse.up();await wait(600);await btn('导出 PNG').click();});
 await step('PDF / 图片按区域导出，可编辑格式保存完整白板',async()=>{await btn('导出 SVG').click();});
},{scenes:true});
await clip('library','统一素材库：逐项搜索、本地与在线分区、自动排列',async()=>{
 await p.locator('.default-sidebar-trigger').click();await step('本地素材库与在线素材库独立折叠，根目录不重复',async()=>{await p.locator('.local-library-results > button').click();await wait(450);await p.locator('.local-library-results > button').click();});
 await step('Ctrl＋滚轮调整预览大小，缩小后自动增加列数',async()=>{const preview=p.locator('.local-library-results .library-drag-preview').first();await preview.hover();await p.keyboard.down('Control');for(let i=0;i<4;i++){await p.mouse.wheel(0,120);await wait(250);}await p.keyboard.up('Control');});
 await step('搜索到每个素材名称，并显示在线加载进度',async()=>{await p.getByRole('searchbox',{name:'搜索本地和在线素材',exact:true}).fill('Search');await wait(3500);});
},{library:true});
await clip('library-folders','本地素材管理：右键文件夹、移入分类、查看保存位置',async()=>{
 await p.locator('.default-sidebar-trigger').click();await step('右键本地素材库，创建自己的分类文件夹',async()=>{await p.locator('.local-library-results > button').click({button:'right'});await p.getByRole('menuitem',{name:'新建素材文件夹',exact:true}).click();await p.getByLabel('素材文件夹名称',{exact:true}).fill('常用图标');await p.locator('form.library-dialog').getByRole('button',{name:'保存',exact:true}).click();});
 await step('右键素材可移动到文件夹，多选同样适用',async()=>{await p.locator('.local-library-results .library-search-card').first().click({button:'right'});await p.getByLabel('素材目标文件夹',{exact:true}).selectOption({label:'常用图标'});await p.getByRole('menuitem',{name:'确认移动',exact:true}).click();});
 await step('查看默认 / 当前素材文件位置，可迁移并保留原文件',async()=>{await btn('素材保存位置').click();await wait(1200);await btn('关闭').click();});
},{library:true});
await clip('toolbar-readonly','工具栏拖拽排序与独立画布只读',async()=>{
 await step('开启排序，直接拖动图标；结束后保存顺序',async()=>{await btn('调整工具栏顺序').click();await drag(p.locator('.App-toolbar [data-local-tool="embed"]'),p.locator('.App-toolbar [data-testid="toolbar-rectangle"]').locator('..'));await btn('调整工具栏顺序').click();});
 await step('画布只读锁定元素编辑，仍允许平移浏览',async()=>{await btn('画布只读').click();await pan(60,20);await btn('解除只读').click();});
});
await clip('settings','设置：中英界面、缩放步长、正式 / 测试更新渠道',async()=>{
 await btn('打开设置').click();await step('缩放步长按 5% 档位选择，并保存设置',async()=>{await p.getByLabel('滚轮缩放步长',{exact:true}).selectOption('15');await btn('保存设置').click();});
 await step('正式 / 测试更新渠道，校验后下载，不自动执行未知包',async()=>{await p.getByLabel('更新渠道',{exact:true}).selectOption('preview');await wait(900);await p.getByLabel('更新渠道',{exact:true}).selectOption('stable');});
 await step('简体中文与英文 UI 同时覆盖外层和原生画布',async()=>{await p.getByLabel('界面语言',{exact:true}).selectOption('en');await wait(900);await p.getByLabel('Language',{exact:true}).selectOption('zh-CN');await btn('关闭设置').click();});
});
await clip('webdav','WebDAV：设置说明、连接状态与手动上传备份',async()=>{
 const {createServer}=await import('node:http');const files=new Map();const dav=createServer(async(req,res)=>{if(req.method==='PROPFIND'){res.writeHead(207,{'Content-Type':'application/xml'});res.end('<d:multistatus xmlns:d="DAV:"><d:response><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>');}else if(req.method==='PUT'){const chunks=[];for await(const c of req)chunks.push(c);files.set(req.url,Buffer.concat(chunks));res.writeHead(201);res.end();}else{res.writeHead(files.has(req.url)?200:404);res.end(files.get(req.url)||'');}});await new Promise(r=>dav.listen(0,'127.0.0.1',r));
 try{
 await btn('打开设置').click();await btn('WebDAV 设置').click();
 await step('设置入口提供说明气泡；此处使用本机演示 WebDAV 端点',async()=>{await btn('WebDAV 功能设置说明').click();await wait(1000);await btn('WebDAV 功能设置说明').click();});
 await p.getByLabel('WebDAV 地址',{exact:true}).fill('http://127.0.0.1:'+dav.address().port+'/backup/');await p.getByLabel('WebDAV 用户名',{exact:true}).fill('demo');await p.getByLabel('WebDAV 密码',{exact:true}).fill('demo-only');await p.getByRole('checkbox',{name:/允许 HTTP/}).check();
 await step('凭据加密保存，测试实际连接；不自动双向同步',async()=>{await btn('保存设置').click();await btn('测试连接').click();await btn('上传工作区备份').click();await wait(600);await btn('关闭').click();});
 await step('绿灯表示 WebDAV 验证成功；下拉手动强制上传',async()=>{await btn('连接状态').click();await btn('立即同步（上传备份）').click();await wait(1000);});
 }finally{await new Promise(r=>dav.close(r));}
},{scenes:true,library:true});
await clip('embeds','HTTPS 网页：独立区域展示，不遮挡预设模板',async()=>{
 await step('网页独立放在模板旁边；六组元素完整保留',async()=>{await wait(1800);});
 await step('拖动网页边缘，仍与模板分开摆放',async()=>{const b=await p.locator('.video-embed iframe').boundingBox();await p.mouse.move(b.x+10,b.y+10);await p.mouse.down();await p.mouse.move(b.x+35,b.y+35,{steps:18});await p.mouse.up();});
 await step('重开文档，先确认外部网址，避免自动连接陌生站点',async()=>{await p.reload();await expect(p.getByRole('dialog',{name:'加载外部网页'})).toBeVisible();});
},{embedded:'https://example.org'});
await clip('video','视频播放与场景暂停：独立视频区，模板不被遮挡',async()=>{
 const mediaState=()=>app.evaluate(async({BrowserWindow})=>{for(const f of BrowserWindow.getAllWindows()[0].webContents.mainFrame.framesInSubtree){if(!f.url.includes('youtube'))continue;try{const value=await f.executeJavaScript(`(()=>{const v=document.querySelector('video');return v?{paused:v.paused,time:v.currentTime,ready:v.readyState,error:v.error?.code,text:document.body.innerText.slice(-500)}:null})()`);if(value)return value;}catch{}}return null;});
 await step('模板与视频分区摆放，先全览两侧布局',async()=>{await wait(1800);});
 await step('切换到独立播放区：视频居中放大，图形不与它重叠',async()=>{await btn('显示场景').click();await p.locator('.scene-target').nth(1).click();await wait(700);await btn('隐藏场景').click();await pan(115,0);const b=await p.locator('.video-embed iframe').boundingBox();await p.mouse.dblclick(b.x+b.width/2,b.y+b.height/2);await wait(500);});
 await step('使用原生播放器播放、拖动进度和暂停',async()=>{
   const b=await p.locator('.video-embed iframe').boundingBox();
   if((await mediaState())?.paused){
     const control=await app.evaluate(async({BrowserWindow})=>{for(const f of BrowserWindow.getAllWindows()[0].webContents.mainFrame.framesInSubtree){if(!f.url.includes('youtube'))continue;try{const v=await f.executeJavaScript(`(()=>{const n=document.querySelector('.ytp-large-play-button')||document.querySelector('.ytp-play-button');if(!n)return null;const r=n.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,w:innerWidth,h:innerHeight};})()`);if(v)return v;}catch{}}return null;});
     if(control)await p.mouse.click(b.x+control.x*b.width/control.w,b.y+control.y*b.height/control.h);else await p.mouse.click(b.x+b.width/2,b.y+b.height/2);
   }

   console.log('VIDEO_STATE_BEFORE',await mediaState());await expect.poll(async()=>(await mediaState())?.time||0,{timeout:20000}).toBeGreaterThan(.2);
   await p.mouse.move(b.x+b.width*.5,b.y+b.height*.7);await wait(400);await p.mouse.click(b.x+b.width*.35,b.y+b.height-20);await wait(900);await p.mouse.click(b.x+14,b.y+b.height-10);await wait(500);
 });
 await step('播放未暂停时切到下一个场景，视频自动暂停',async()=>{
   const b=await p.locator('.video-embed iframe').boundingBox();
   if((await mediaState())?.paused){
     const control=await app.evaluate(async({BrowserWindow})=>{for(const f of BrowserWindow.getAllWindows()[0].webContents.mainFrame.framesInSubtree){if(!f.url.includes('youtube'))continue;try{const v=await f.executeJavaScript(`(()=>{const n=document.querySelector('.ytp-large-play-button')||document.querySelector('.ytp-play-button');if(!n)return null;const r=n.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,w:innerWidth,h:innerHeight};})()`);if(v)return v;}catch{}}return null;});
     if(control)await p.mouse.click(b.x+control.x*b.width/control.w,b.y+control.y*b.height/control.h);else await p.mouse.click(b.x+b.width/2,b.y+b.height/2);
   }

   await expect.poll(async()=>(await mediaState())?.paused,{timeout:15000}).toBe(false);await wait(800);
   await btn('显示场景').click();await p.locator('.scene-target').last().click();await expect.poll(async()=>(await mediaState())?.paused).toBe(true);
 });
},{embedded:'https://www.youtube.com/watch?v=M7lc1UVf-VE'});
await clip('nas-web','NAS 网页版：浏览器编辑、服务端保存与重载恢复',async()=>{
 await step('浏览器打开同一套画布，保存到 NAS 服务端 SQLite',async()=>{await pick(text);const s=p.getByRole('slider',{name:'字号比例',exact:true});await s.fill('80');await s.press('Tab');await btn('保存').click();});
 await step('刷新后恢复内容、场景和视图',async()=>{await p.reload();await expect(p.locator('.excalidraw')).toBeVisible();await wait(700);});
 await step('可打开完整白板文件，或下载备份到本机',async()=>{await tools();await wait(800);});
},{scenes:true,library:true,web:true});
await clip('library-online','在线素材包：展开、冻结标题、拖入画布与离线保存',async()=>{
 await p.locator('.default-sidebar-trigger').click();await btn('Excalidraw 在线素材库').click();
 const pack=p.getByRole('button',{name:/Microsoft.*365/i}).first();await expect(pack).toBeVisible({timeout:30000});await pack.click();
 await expect(p.locator('.online-library-package .library-drag-preview').first()).toBeVisible({timeout:30000});
 await step('展开真实在线素材包，目录标题保持可收起',async()=>{await p.locator('.library-menu-items-container__items').evaluate(e=>e.scrollTop+=380);await wait(800);});
 await step('素材栏可拖宽；Ctrl＋滚轮自动排列更多缩略图',async()=>{const h=p.getByRole('separator',{name:'素材栏宽度',exact:true}),b=await h.boundingBox();await p.mouse.move(b.x+4,b.y+120);await p.mouse.down();await p.mouse.move(b.x-220,b.y+120,{steps:20});await p.mouse.up();const a=p.locator('.online-library-package .library-drag-preview').first();await a.hover();await p.keyboard.down('Control');await p.mouse.wheel(0,120);await p.keyboard.up('Control');});
 await step('保存到本地库后可离线使用',async()=>{await p.locator('.online-library-package').filter({has:pack}).getByRole('button',{name:'保存素材',exact:true}).first().click();await wait(900);});
},{library:true});
writeFileSync(join(out,'source-info.json'),JSON.stringify({template:'user new whiteboard',elements:art.length,regions:regions.map(r=>r[0])}));
