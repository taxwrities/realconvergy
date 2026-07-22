import {useRef} from 'react';

/* Bottom sheet with swipe-dismiss (§3 fluidity).
   Swipe-to-dismiss is armed ONLY from the grab handle / title header — never
   from inside the scrollable body — so scrolling a long results list can't be
   misread as a dismiss gesture and lock the user out. The body scrolls
   natively with overscroll containment. */
export default function Sheet({title,onClose,children}){
  const startY=useRef(null);
  const el=useRef(null);
  const onTouchStart=e=>{startY.current=e.touches[0].clientY};
  const onTouchMove=e=>{
    if(startY.current==null)return;
    const dy=e.touches[0].clientY-startY.current;
    if(el.current&&dy>0)el.current.style.transform=`translateY(${dy}px)`;
  };
  const onTouchEnd=e=>{
    if(startY.current==null)return;
    const dy=e.changedTouches[0].clientY-startY.current;
    startY.current=null;
    if(dy>90)onClose();
    else if(el.current)el.current.style.transform='';
  };
  return(
    <>
      <div className="sheet-scrim" onClick={onClose}/>
      <div className="sheet" ref={el}>
        <div className="sheet-head"
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <div className="sheet-grab"/>
          {title&&<h2>{title}</h2>}
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </>
  );
}
