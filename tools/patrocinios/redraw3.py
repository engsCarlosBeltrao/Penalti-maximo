from lib import *
def ezze(col,H=40,total=178,outline=None):
    f=FI+'Inter-Black.otf'; size=H/0.727
    c=Canvas(320,80); base=60
    w=c.width('EZZE',f,size,0); sp=(total-w)/3
    x=c.text((4,base),'EZZE',f,size,col,spacing=sp)
    c.rrect((x+12,base-H-1,x+12+H+4,base+1),9,outline=col,width=5)
    t=c.finish()
    if outline is not None:
        pad=4; big=np.zeros((t.shape[0]+2*pad,t.shape[1]+2*pad,4),np.float32); big[pad:-pad,pad:-pad]=t
        al=cv2.dilate(big[...,3],cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(5,5)))
        ol=np.zeros_like(big); ol[...,:3]=outline; ol[...,3]=al
        tmp=np.zeros_like(big)
        # composite letters over outline
        a3=big[...,3:]/255
        tmp[...,:3]=big[...,:3]*a3+ol[...,:3]*(1-a3); tmp[...,3]=np.maximum(big[...,3],ol[...,3])
        t=tmp
    return t
def feather_mask(h,w,f):
    m=np.ones((h,w),np.float32)
    for i in range(f):
        v=(i+1)/(f+1); m[:,i]=np.minimum(m[:,i],v); m[:,-1-i]=np.minimum(m[:,-1-i],v)
    return m[...,None]
def shift_block(a,y0,y1,dy,x0,x1,fillrow_y,f=8):
    blk=a[y0:y1,x0:x1].copy()
    row=np.median(a[fillrow_y:fillrow_y+4,x0:x1],0)
    fm=feather_mask(y1+dy,x1-x0,f)
    reg=a[0:y1+dy,x0:x1]
    new=reg.copy(); new[:]=row[None]
    a[0:y1+dy,x0:x1]=reg*(1-fm)+new*fm
    bm=feather_mask(y1-y0,x1-x0,f)
    d=a[y0+dy:y1+dy,x0:x1]; a[y0+dy:y1+dy,x0:x1]=d*(1-bm)+blk*bm
    return a
CX=(640+878)/2
# away: block shift (vertical stripes)
a=load('corinthians_away'); shift_block(a,19,60,38,622,905,104)
t=ezze((246,246,246),outline=(10,10,10)); paste(a,t,CX-t.shape[1]/2,10); save('corinthians_away',a)
for k,col,kind,p in [('corinthians_home',(18,18,18),'lo',(100,170)),('corinthians_third',(196,196,196),'hi',(90,140))]:
    a=load(k)
    seg=extract(a,(628,892,22,60),kind,p)
    a=inpaint_ink(a,(622,905,0,62),kind,p,grow=3)
    t=ezze(col)
    paste(a,t,CX-t.shape[1]/2,12)
    paste(a,seg,CX-seg.shape[1]/2,12+t.shape[0]+6)
    save(k,a); print(k,seg.shape,t.shape)
