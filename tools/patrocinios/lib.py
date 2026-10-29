import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont
K='/mnt/user-data/outputs/penaltis/assets/kits/'
O='/tmp/w/kits_orig/'
def load(k): return np.array(Image.open(O+k+'.jpg').convert('RGB')).astype(np.float32)
def save(k,a): Image.fromarray(np.clip(a,0,255).astype(np.uint8)).save(K+k+'.jpg',quality=96,subsampling=0)
def lum(a): return 0.299*a[...,0]+0.587*a[...,1]+0.114*a[...,2]
def sstep(x,e0,e1):
    t=np.clip((x-e0)/(e1-e0),0,1); return t*t*(3-2*t)
def erase(a,box,feather=3):
    x0,x1,y0,y1=box; h=y1-y0
    H=a.shape[0]
    src=a[y1:y1+h,x0:x1]
    if src.shape[0]<h:
        src=np.concatenate([src,src[::-1]],0)[:h]
    src=src[::-1]  # mirror for seam continuity
    m=np.ones((h,x1-x0),np.float32)
    for i in range(feather):
        v=(i+1)/(feather+1); m[:,i]=np.minimum(m[:,i],v); m[:,-1-i]=np.minimum(m[:,-1-i],v)
    for i in range(feather):
        v=(i+1)/(feather+1); m[-1-i,:]=np.minimum(m[-1-i,:],v)
    m=m[...,None]
    a[y0:y1,x0:x1]=a[y0:y1,x0:x1]*(1-m)+src*m
    return a
def bbox_alpha(al,t=0.12):
    ys,xs=np.where(al>t)
    return xs.min(),xs.max()+1,ys.min(),ys.max()+1
def extract(a,region,kind,p=(100,180),bg=None):
    """returns (rgba float HxWx4 0..255 cropped to ink bbox)"""
    x0,x1,y0,y1=region; c=a[y0:y1,x0:x1]
    if kind=='hi': al=sstep(lum(c),*p)
    elif kind=='lo': al=1-sstep(lum(c),*p)
    else:
        if bg is None:
            bg=np.median(np.concatenate([c[:3].reshape(-1,3),c[-3:].reshape(-1,3)]),0)
        d=np.abs(c-bg).max(-1); al=sstep(d,*p)
    bx0,bx1,by0,by1=bbox_alpha(al)
    out=np.concatenate([c,al[...,None]*255],-1)[by0:by1,bx0:bx1]
    return out
def tint(rgba,color):
    o=rgba.copy(); o[...,:3]=np.array(color,np.float32); return o
def resize(rgba,w=None,s=None):
    h0,w0=rgba.shape[:2]
    if s is None: s=w/w0
    nw,nh=max(1,round(w0*s)),max(1,round(h0*s))
    pm=rgba.copy(); pm[...,:3]*=pm[...,3:]/255
    r=cv2.resize(pm,(nw,nh),interpolation=cv2.INTER_AREA if s<1 else cv2.INTER_CUBIC)
    al=r[...,3:]; rgb=np.where(al>0.5,r[...,:3]/np.maximum(al/255,1e-3),0)
    return np.concatenate([np.clip(rgb,0,255),al],-1)
def paste(a,rgba,x,y,op=1.0):
    h,w=rgba.shape[:2]; H,W=a.shape[:2]
    x=int(round(x));y=int(round(y))
    sx0=max(0,-x);sy0=max(0,-y);ex=min(w,W-x);ey=min(h,H-y)
    al=(rgba[sy0:ey,sx0:ex,3:]/255)*op
    dst=a[y+sy0:y+ey,x+sx0:x+ex]
    a[y+sy0:y+ey,x+sx0:x+ex]=dst*(1-al)+rgba[sy0:ey,sx0:ex,:3]*al
    return a
def text_rgba(txt,font,size,color,spacing=0,stroke=0,stroke_color=None):
    f=ImageFont.truetype(font,size)
    # measure
    widths=[f.getlength(ch) for ch in txt]
    tw=int(sum(widths)+spacing*(len(txt)-1))+8+stroke*2; th=int(size*1.5)+stroke*2
    S=4
    im=Image.new('L',(tw*S,th*S),0); d=ImageDraw.Draw(im)
    f4=ImageFont.truetype(font,size*S)
    x=(4+stroke)*S
    for ch,w in zip(txt,widths):
        d.text((x,(stroke+4)*S),ch,font=f4,fill=255); x+=(w+spacing)*S
    im=im.resize((tw,th),Image.LANCZOS)
    al=np.array(im,np.float32)
    rgba=np.zeros((th,tw,4),np.float32); rgba[...,:3]=color; rgba[...,3]=al
    bx0,bx1,by0,by1=bbox_alpha(al/255,0.05)
    return rgba[by0:by1,bx0:bx1]

def clean_template(t,open_k=None,drop_top_frac=None,min_area=0):
    al=t[...,3].copy()
    if open_k:
        m=(al>128).astype(np.uint8)
        m2=cv2.morphologyEx(m,cv2.MORPH_OPEN,np.ones((1,open_k),np.uint8))
        al=al*cv2.dilate(m2,np.ones((3,3),np.uint8)).astype(np.float32)
    if drop_top_frac is not None:
        n,lab,st,_=cv2.connectedComponentsWithStats((al>40).astype(np.uint8),8)
        H=al.shape[0]
        for i in range(1,n):
            if st[i,1]+st[i,3] < drop_top_frac*H and st[i,4]<min_area: al[lab==i]=0
    o=t.copy();o[...,3]=al
    b=bbox_alpha(al/255,0.05); return o[b[2]:b[3],b[0]:b[1]]
def inpaint_ink(a,region,kind,p,grow=3,extra=None,bg=None):
    x0,x1,y0,y1=region; c=a[y0:y1,x0:x1]
    if kind=='dist':
        if bg is None: bg=np.median(np.concatenate([c[:2].reshape(-1,3),c[-2:].reshape(-1,3)]),0)
        al=sstep(np.abs(c-bg).max(-1),*p)
    elif kind=='hi': al=sstep(lum(c),*p)
    elif kind=='blue': al=sstep(c[...,2]-c[...,0],*p)
    elif kind=='rb': al=sstep(c[...,0]-c[...,2],*p)
    else: al=1-sstep(lum(c),*p)
    m=(al>0.15).astype(np.uint8)
    m=cv2.dilate(m,np.ones((grow*2+1,grow*2+1),np.uint8))
    full=np.zeros(a.shape[:2],np.uint8); full[y0:y1,x0:x1]=m
    out=cv2.inpaint(np.clip(a,0,255).astype(np.uint8),full,4,cv2.INPAINT_TELEA)
    return out.astype(np.float32)

FI='/usr/share/fonts/opentype/inter/'
S4=4
class Canvas:
    def __init__(s,w,h):
        s.w,s.h=w,h; s.im=Image.new('RGBA',(w*S4,h*S4),(0,0,0,0)); s.d=ImageDraw.Draw(s.im)
    def poly(s,pts,fill): s.d.polygon([(x*S4,y*S4) for x,y in pts],fill=tuple(fill)+(255,))
    def rrect(s,box,r,fill=None,outline=None,width=1):
        s.d.rounded_rectangle([c*S4 for c in box],radius=r*S4,fill=None if fill is None else tuple(fill)+(255,),outline=None if outline is None else tuple(outline)+(255,),width=int(width*S4))
    def ell(s,box,fill=None,outline=None,width=1):
        s.d.ellipse([c*S4 for c in box],fill=None if fill is None else tuple(fill)+(255,),outline=None if outline is None else tuple(outline)+(255,),width=int(width*S4))
    def text(s,xy,txt,font,size,fill,spacing=0,stroke=0,stroke_fill=None,anchor='ls'):
        f=ImageFont.truetype(font,int(size*S4)); x,y=xy
        if spacing==0:
            s.d.text((x*S4,y*S4),txt,font=f,fill=tuple(fill)+(255,),anchor=anchor,stroke_width=int(stroke*S4),stroke_fill=None if stroke_fill is None else tuple(stroke_fill)+(255,))
            return x+f.getlength(txt)/S4
        for ch in txt:
            s.d.text((x*S4,y*S4),ch,font=f,fill=tuple(fill)+(255,),anchor=anchor,stroke_width=int(stroke*S4),stroke_fill=None if stroke_fill is None else tuple(stroke_fill)+(255,))
            x+=f.getlength(ch)/S4+spacing
        return x
    def width(s,txt,font,size,spacing=0):
        f=ImageFont.truetype(font,int(size*S4)); return (f.getlength(txt)/S4)+spacing*(len(txt)-1)
    def finish(s,crop=True):
        a=np.array(s.im,np.float32)
        al=a[...,3:]/255; pm=np.concatenate([a[...,:3]*al,a[...,3:]],-1)
        r=cv2.resize(pm,(s.w,s.h),interpolation=cv2.INTER_AREA)
        al2=r[...,3:]; rgb=np.where(al2>0.5,r[...,:3]/np.maximum(al2/255,1e-3),0)
        out=np.concatenate([np.clip(rgb,0,255),al2],-1)
        if crop:
            b=bbox_alpha(al2[...,0]/255,0.03); out=out[b[2]:b[3],b[0]:b[1]]
        return out
