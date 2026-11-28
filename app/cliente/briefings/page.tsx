"use client";
import { useEffect,useMemo,useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../../../supabase";
type Section={id:string;heading:string;scene:string;speech:string};type Video={id:string;title:string;sections:Section[]};type Content={videos:Video[]};type Briefing={id:string;title:string;content:Content;updated_at:string};
const normalize=(value:any):Content=>({videos:Array.isArray(value?.videos)?value.videos.map((v:any)=>({...v,sections:Array.isArray(v.sections)?v.sections:[]})):[]});

function downloadBriefingPdf(briefing:Briefing,content:Content){
 const clean=(value:string)=>String(value||"").normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").replace(/[^\\x20-\\x7E]/g," ").replace(/\\s+/g," ").trim();
 const lines:{text:string;size:number;bold:boolean;gap:number}[]=[];
 lines.push({text:"VYRA HUB",size:10,bold:true,gap:18});
 lines.push({text:clean(briefing.title),size:20,bold:true,gap:8});
 lines.push({text:"ROTEIROS E ORIENTACOES",size:9,bold:false,gap:20});
 content.videos.forEach((video,index)=>{
  lines.push({text:"ROTEIRO "+String(index+1).padStart(2,"0")+" - "+clean(video.title),size:14,bold:true,gap:12});
  video.sections.forEach((section,i)=>{
   lines.push({text:clean(section.heading||("ETAPA "+(i+1))),size:12,bold:true,gap:5});
   if(section.scene)lines.push({text:"CENA: "+clean(section.scene),size:10,bold:false,gap:8});
   if(section.speech)lines.push({text:"FALA: "+clean(section.speech),size:10,bold:false,gap:12});
  });
  lines.push({text:"",size:10,bold:false,gap:10});
 });
 const pages:string[][]=[];let page:string[]=[];let y=790;
 const wrap=(s:string,max:number)=>{const words=s.split(" ");const out:string[]=[];let line="";for(const word of words){if((line+" "+word).trim().length>max&&line){out.push(line);line=word;}else line=(line+" "+word).trim();}if(line)out.push(line);return out;};
 for(const item of lines){const wrapped=wrap(item.text,item.size>=18?48:item.size>=14?68:94);for(const part of (wrapped.length?wrapped:[""])){const needed=item.size+item.gap;if(y-needed<48){pages.push(page);page=[];y=790;}page.push(`${item.bold?"B":"R"}|${item.size}|${y}|${part}`);y-=needed;}}
 if(page.length)pages.push(page);
 const objects:string[]=[];const add=(s:string)=>{objects.push(s);return objects.length;};
 const catalog=add("<< /Type /Catalog /Pages 2 0 R >>");
 const pagesObj=add("");
 const fontRegular=add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
 const fontBold=add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
 const pageRefs:number[]=[];
 for(const pg of pages){let stream="";for(const row of pg){const [weight,size,ys,...rest]=row.split("|");const txt=rest.join("|").replace(/\\\\/g,"\\\\").replace(/\\(/g,"\\\\(").replace(/\\)/g,"\\\\)");stream+=`BT /${weight==="B"?"F2":"F1"} ${size} Tf 48 ${ys} Td (${txt}) Tj ET\\n`;}
 const contentObj=add(`<< /Length ${stream.length} >>\\nstream\\n${stream}endstream`);
 const pageObj=add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${contentObj} 0 R >>`);
 pageRefs.push(pageObj);
 }
 objects[pagesObj-1]=`<< /Type /Pages /Kids [${pageRefs.map(n=>n+" 0 R").join(" ")}] /Count ${pageRefs.length} >>`;
 let pdf="%PDF-1.4\\n";const offsets=[0];objects.forEach((obj,i)=>{offsets.push(pdf.length);pdf+=`${i+1} 0 obj\\n${obj}\\nendobj\\n`;});const xref=pdf.length;pdf+=`xref\\n0 ${objects.length+1}\\n0000000000 65535 f \\n`;for(let i=1;i<offsets.length;i++)pdf+=String(offsets[i]).padStart(10,"0")+" 00000 n \\n";pdf+=`trailer << /Size ${objects.length+1} /Root ${catalog} 0 R >>\\nstartxref\\n${xref}\\n%%EOF`;
 const blob=new Blob([pdf],{type:"application/pdf"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=clean(briefing.title||"briefing").replace(/[^a-zA-Z0-9]+/g,"-").replace(/^-|-$/g,"")+".pdf";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function ClientBriefingsPage(){
 const router=useRouter();const [rows,setRows]=useState<Briefing[]>([]);const [selected,setSelected]=useState("");const [content,setContent]=useState<Content>({videos:[]});const [saving,setSaving]=useState(false);const [loading,setLoading]=useState(true);const [error,setError]=useState("");const [notice,setNotice]=useState("");
 const current=useMemo(()=>rows.find(r=>r.id===selected)||null,[rows,selected]);
 useEffect(()=>{let live=true;(async()=>{try{const sb=supabaseBrowser();const {data:a}=await sb.auth.getUser();if(!a.user){router.replace("/login");return;}const {data:p,error:pe}=await sb.from("profiles").select("role,client_id").eq("id",a.user.id).single();if(pe||!p||p.role!=="client"||!p.client_id){router.replace(p?.role==="admin"?"/dashboard":"/login");return;}const {data,error}=await sb.from("briefings").select("id,title,content,updated_at").eq("client_id",p.client_id).eq("status","published").order("created_at",{ascending:false});if(error)throw error;if(live){const list=(data||[]).map((r:any)=>({...r,content:normalize(r.content)}));setRows(list);if(list[0]){setSelected(list[0].id);setContent(list[0].content)}}}catch(e){if(live)setError(e instanceof Error?e.message:"Não foi possível carregar os briefings.");}finally{if(live)setLoading(false)}})();return()=>{live=false}},[router]);
 function patchVideo(videoId:string,value:string){setContent(c=>({...c,videos:c.videos.map(v=>v.id===videoId?{...v,title:value}:v)}));}
 function patch(videoId:string,sectionId:string,key:"heading"|"scene"|"speech",value:string){setContent(c=>({...c,videos:c.videos.map(v=>v.id===videoId?{...v,sections:v.sections.map(s=>s.id===sectionId?{...s,[key]:value}:s)}:v)}));}
 function choose(id:string){const row=rows.find(r=>r.id===id);if(row){setSelected(id);setContent(normalize(row.content));setNotice("");setError("");}}
 async function save(){if(!current)return;setSaving(true);setError("");setNotice("");const {error}=await supabaseBrowser().from("briefings").update({content}).eq("id",current.id);if(error)setError(error.message);else{setRows(prev=>prev.map(r=>r.id===current.id?{...r,content,updated_at:new Date().toISOString()}:r));setNotice("Suas alterações foram salvas.");}setSaving(false);}
 if(loading)return <main className="client-module-page"><p>Carregando seus briefings...</p></main>;
 return <main className="client-module-page client-briefing-page"><div className="client-module-content"><p className="client-module-kicker">ROTEIROS E ORIENTAÇÕES DA SUA MARCA</p><h1>Seus <em>briefings.</em></h1><p className="client-module-intro">Consulte os roteiros e atualize cenas ou falas quando necessário. Suas alterações ficam registradas para a equipe VYRA.</p>{error&&<p className="client-module-error">{error}</p>}{notice&&<p className="briefing-client-notice">{notice}</p>}
 {rows.length===0?<div className="client-module-empty"><span>✦</span><h2>Nenhum briefing disponível.</h2><p>Quando a equipe VYRA disponibilizar um briefing, ele aparecerá aqui.</p></div>:<><div className="client-briefing-layout"><nav className="client-briefing-list">{rows.map(r=><button key={r.id} className={selected===r.id?"active":""} onClick={()=>choose(r.id)}>{r.title}</button>)}</nav>{current&&<section className="client-briefing-document"><div className="client-briefing-document-head"><div><span>BRIEFING VYRA · {new Date(current.updated_at).toLocaleDateString("pt-BR")}</span><h2>{current.title}</h2></div><button className="client-service-cta briefing-print-button" onClick={()=>downloadBriefingPdf(current,content)}>BAIXAR PDF ↓</button></div>{content.videos.map((video,index)=><article className="client-briefing-video" key={video.id}><p className="client-briefing-video-index">ROTEIRO {String(index+1).padStart(2,"0")}</p><input className="client-briefing-video-title" aria-label="Título do roteiro" value={video.title} onChange={e=>patchVideo(video.id,e.target.value)}/>{video.sections.map((s,i)=><section className="client-briefing-step" key={s.id}><input className="client-briefing-stage-title" aria-label="Título da etapa" value={s.heading} onChange={e=>patch(video.id,s.id,"heading",e.target.value)}/><label className="briefing-scene-label">CENA · O QUE DEVE ACONTECER<textarea rows={3} value={s.scene} onChange={e=>patch(video.id,s.id,"scene",e.target.value)}/></label><label className="briefing-speech-label">FALA · O QUE DEVE SER DITO<textarea rows={3} value={s.speech} onChange={e=>patch(video.id,s.id,"speech",e.target.value)}/></label></section>)}</article>)}<div className="briefing-client-save"><button className="client-service-cta" disabled={saving} onClick={save}>{saving?"SALVANDO...":"SALVAR MINHAS ALTERAÇÕES"}</button></div></section>}</div></>}
 </div></main>;
}
