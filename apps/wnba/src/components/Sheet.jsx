import {useRef} from 'react';

/* Bottom sheet with swipe-dismiss (§3 fluidity). */
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
    const dy=e.changedTouches[0].clientY-(startY.current??0);
    startY.current=null;
    if(dy>90)onClose();
    else if(el.current)el.current.style.transform='';
  };
  return(
    <>
      <div className="sheet-scrim" onClick={onClose}/>
      <div className="sheet" ref={el}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <div className="sheet-grab"/>
        {title&&<h2>{title}</h2>}
        {children}
      </div>
    </>
  );
}
