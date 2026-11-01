"""Encode real application screenshot sequences as full-color lossless animated WebP.
Usage: python3 scripts/encode-feature-animations.py /path/to/frames ../docs/local-canvas/features
Requires Pillow. Only successful recorder sequences are published.
"""
import json, sys
from pathlib import Path
from PIL import Image, ImageOps
root=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
entries={}
for p in sorted(root.glob('manifest-*.json'),key=lambda p:p.stat().st_mtime):
    for e in json.loads(p.read_text()):entries[e['name']]=e
manifest=[]
for name,e in entries.items():
    if e['status']!='ok':continue
    frames=[]
    paths=sorted((root/name).glob('*.png'))
    durations=[]
    for i,p in enumerate(paths):
        image=Image.open(p).convert('RGB')
        image=ImageOps.contain(image,(1440,960),Image.Resampling.LANCZOS)
        canvas=Image.new('RGB',(1440,960),'white');canvas.paste(image,((1440-image.width)//2,(960-image.height)//2))
        frames.append(canvas)
        durations.append(max(40,min(600,round((paths[i+1].stat().st_mtime-p.stat().st_mtime)*1000))) if i+1<len(paths) else 1400)
    if len(frames)<2:raise RuntimeError('Animation needs multiple real frames: '+name)
    target=out/(name+'.webp');frames[0].save(target,save_all=True,append_images=frames[1:],duration=durations,loop=0,lossless=True,method=4,minimize_size=True)
    check=Image.open(target);assert check.n_frames>1
    entry={'file':target.name,'title':e['title'],'frames':check.n_frames,'bytes':target.stat().st_size,'template':'new 白板演示副本','recording':'真实界面；录制字幕与指针高亮为演示标注；视频与模板分区摆放'}
    manifest.append(entry);print(name,check.n_frames,round(target.stat().st_size/1024),'KiB',flush=True)
(out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
