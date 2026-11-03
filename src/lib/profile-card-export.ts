import { CARD_HEIGHT, CARD_WIDTH } from "./profile-card";

function bounded<T>(promise: Promise<T>, message: string, milliseconds=8000): Promise<T> {
  let timer:ReturnType<typeof setTimeout>;
  return Promise.race([promise,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error(message)),milliseconds);})]).finally(()=>clearTimeout(timer));
}

/** Rasterize the already-frozen preview SVG. No network, remote images, or foreignObject. */
export async function profileCardPng(svg: string): Promise<Blob> {
  if (document.fonts) await bounded(document.fonts.ready,"Fonts are taking too long to load. Wait a moment and retry.");
  const source=URL.createObjectURL(new Blob([svg],{type:"image/svg+xml;charset=utf-8"}));
  const image=new Image();
  try {
    image.src=source;
    await bounded(image.decode(),"The card image could not load. Refresh Profile and retry.");
    const canvas=document.createElement("canvas");
    canvas.width=CARD_WIDTH*2;canvas.height=CARD_HEIGHT*2;
    const context=canvas.getContext("2d");
    if(!context) throw new Error("This browser cannot create the PNG. Try a current browser.");
    context.drawImage(image,0,0,canvas.width,canvas.height);
    try { return await bounded(new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("PNG creation failed. Retry the download.")),"image/png")),"PNG creation took too long. Retry the download."); }
    finally {canvas.width=0;canvas.height=0;}
  } finally {image.src="";URL.revokeObjectURL(source);}
}

export function downloadCard(blob: Blob, filename: string) {
  const url=URL.createObjectURL(blob),anchor=document.createElement("a");
  try {anchor.href=url;anchor.download=filename;document.body.appendChild(anchor);anchor.click();}
  finally {anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
