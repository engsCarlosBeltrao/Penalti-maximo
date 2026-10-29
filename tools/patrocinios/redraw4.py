from lib import *
def redbulls(fill,outline=None,size=46):
    f=FI+'Inter-ExtraBoldItalic.otf'
    c=Canvas(360,90)
    # outline
    if outline is not None:
        c.text((12,62),'Red Bulls',f,size,fill,spacing=0,stroke=3.2,stroke_fill=outline)
    c.text((12,62),'Red Bulls',f,size,fill,spacing=0)
    t=c.finish()
    # slight arc/rotation
    h,w=t.shape[:2]; M=cv2.getRotationMatrix2D((w/2,h/2),3.5,1.0)
    pad=10; big=np.zeros((h+2*pad,w+2*pad,4),np.float32); big[pad:-pad,pad:-pad]=t
    pm=big.copy(); pm[...,:3]*=pm[...,3:]/255
    r=cv2.warpAffine(pm,cv2.getRotationMatrix2D(((w+2*pad)/2,(h+2*pad)/2),3.5,1.0),(w+2*pad,h+2*pad),flags=cv2.INTER_CUBIC)
    al=r[...,3:]; rgb=np.where(al>0.5,r[...,:3]/np.maximum(al/255,1e-3),0)
    o=np.concatenate([np.clip(rgb,0,255),np.clip(al,0,255)],-1)
    b=bbox_alpha(o[...,3]/255,0.03); return o[b[2]:b[3],b[0]:b[1]]
for k,fill,outl,bg in [('bragantino_home',(214,22,36),(255,255,255),None),('bragantino_third',(14,14,14),None,None)]:
    a=load(k)
    bgc=np.median(a[44:47,596:620].reshape(-1,3),0)
    a=inpaint_ink(a,(612,920,0,47),'dist',(10,45),grow=5,bg=bgc)
    t=redbulls(fill,outl); print(k,t.shape)
    paste(a,t,(640+892)/2-t.shape[1]/2,4)
    save(k,a)
