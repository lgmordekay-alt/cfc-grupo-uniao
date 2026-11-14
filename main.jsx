import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { LayoutDashboard, Users, CalendarDays, LogOut, Plus, Search, Pencil, Check, X, GraduationCap, ClipboardList } from 'lucide-react';
import './style.css';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = url && key ? createClient(url, key) : null;

const STATUS = {
  aguardando_agendamento:'Aguardando agendamento',
  prova_marcada:'Prova marcada',
  prova_realizada:'Prova realizada',
  aprovado:'Aprovado',
  reprovado:'Reprovado',
  reagendar:'Reagendar'
};
const SITUATIONS = ['agendado','compareceu','aprovado','reprovado','ausente'];
const SITUATION_LABEL = {agendado:'Agendado',compareceu:'Compareceu',aprovado:'Aprovado',reprovado:'Reprovado',ausente:'Ausente'};
const emptyStudent = {full_name:'',renach:'',category:'B',instructor_name:'',registered_on:new Date().toISOString().slice(0,10),notes:''};

function App(){
  const [session,setSession] = useState(null);
  const [profile,setProfile] = useState(null);
  const [page,setPage] = useState('painel');
  const [students,setStudents] = useState([]);
  const [sessions,setSessions] = useState([]);
  const [appointments,setAppointments] = useState([]);
  const [loading,setLoading] = useState(false);
  const [notice,setNotice] = useState('');
  const [search,setSearch] = useState('');
  const [studentForm,setStudentForm] = useState(null);
  const [sessionForm,setSessionForm] = useState(null);
  const [selectedSession,setSelectedSession] = useState(null);
  const [login,setLogin] = useState({email:'',password:''});

  useEffect(()=>{
    if(!supabase) return;
    supabase.auth.getSession().then(({data})=>setSession(data.session));
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));
    return ()=>subscription.unsubscribe();
  },[]);
  useEffect(()=>{ if(session) loadAll(); else {setProfile(null);setStudents([]);} },[session]);
  async function loadAll(){
    setLoading(true);
    const [{data:user},{data:roles},{data:ss},{data:ses},{data:aps}] = await Promise.all([
      supabase.from('profiles').select('*').eq('id',session.user.id).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id',session.user.id),
      supabase.from('students').select('*').order('created_at',{ascending:false}),
      supabase.from('exam_sessions').select('*').order('scheduled_at'),
      supabase.from('exam_appointments').select('*, student:students(full_name,renach,category)')
    ]);
    setProfile({...user,role:roles?.[0]?.role || 'instrutor'});
    setStudents(ss||[]); setSessions(ses||[]); setAppointments(aps||[]);
    setLoading(false);
  }
  const admin = profile?.role==='admin' || profile?.role==='secretaria';
  const filtered = useMemo(()=>students.filter(s=>(s.full_name+' '+s.renach).toLowerCase().includes(search.toLowerCase())),[students,search]);
  const counts = useMemo(()=>Object.fromEntries(Object.keys(STATUS).map(k=>[k,students.filter(s=>s.status===k).length])),[students]);
  async function signIn(e){e.preventDefault();setNotice('');const {error}=await supabase.auth.signInWithPassword(login);if(error)setNotice(error.message);}
  async function saveStudent(e){
    e.preventDefault(); const form=studentForm;
    const payload={full_name:form.full_name.trim(),renach:form.renach.trim().toUpperCase(),category:form.category,instructor_name:form.instructor_name||null,registered_on:form.registered_on,notes:form.notes||null};
    const result=form.id ? await supabase.from('students').update(payload).eq('id',form.id) : await supabase.from('students').insert(payload);
    if(result.error){setNotice(result.error.message);return;} setStudentForm(null);setNotice('Cadastro salvo.');loadAll();
  }
  async function saveSession(e){
    e.preventDefault(); const f=sessionForm;
    const {data,error}=await supabase.from('exam_sessions').insert({scheduled_at:new Date(f.scheduled_at).toISOString(),category:f.category,location:f.location,notes:f.notes||null}).select().single();
    if(error){setNotice(error.message);return;} setSessionForm(null);setSelectedSession(data);setNotice('Data de prova cadastrada.');loadAll();
  }
  async function addStudentToSession(studentId){
    const s=students.find(x=>x.id===studentId); const sess=sessions.find(x=>x.id===selectedSession?.id);
    if(!s||!sess)return;
    const compatible=s.category==='AB'||(sess.category==='moto'&&s.category==='A')||(sess.category==='carro'&&s.category==='B');
    if(!compatible){setNotice('A categoria do aluno não é compatível com esta prova.');return;}
    const {error}=await supabase.from('exam_appointments').insert({student_id:studentId,session_id:sess.id,scheduled_at:sess.scheduled_at,location:sess.location});
    if(error){setNotice(error.message);return;}
    await supabase.from('students').update({status:'prova_marcada'}).eq('id',studentId);
    setNotice('Aluno incluído na data de prova.');loadAll();
  }
  async function updateSituation(appt,situation){
    const map={agendado:['agendada',null,'prova_marcada'],compareceu:['realizada',null,'prova_realizada'],aprovado:['realizada','aprovado','aprovado'],reprovado:['realizada','reprovado','reprovado'],ausente:['ausente',null,'reagendar']};
    const [status,result,studentStatus]=map[situation];
    const a=await supabase.from('exam_appointments').update({status,result}).eq('id',appt.id);
    if(a.error){setNotice(a.error.message);return;}
    await supabase.from('students').update({status:studentStatus}).eq('id',appt.student_id);
    setNotice('Situação atualizada.');loadAll();
  }
  async function logout(){await supabase.auth.signOut();}
  if(!supabase) return <div className="setup"><h1>CFC GRUPO UNIÃO</h1><p>Configure as variáveis do Supabase no arquivo <b>.env</b>. Veja o README.</p></div>;
  if(!session) return <main className="login"><section className="login-brand"><div className="logo">CFC <b>GRUPO UNIÃO</b></div><h1>Controle de Provas</h1><p>Alunos, colaboradores e agenda de exames em um só lugar.</p></section><form className="login-form" onSubmit={signIn}><h2>Acessar sistema</h2><label>E-mail<input type="email" required value={login.email} onChange={e=>setLogin({...login,email:e.target.value})}/></label><label>Senha<input type="password" required value={login.password} onChange={e=>setLogin({...login,password:e.target.value})}/></label>{notice&&<p className="notice">{notice}</p>}<button className="primary">Entrar</button></form></main>;
  return <div className="app">
    <aside className="sidebar"><div className="logo">CFC <b>GRUPO UNIÃO</b></div><small>SISTEMA DE CONTROLE</small><nav>
      <button className={page==='painel'?'active':''} onClick={()=>setPage('painel')}><LayoutDashboard/>Painel</button>
      <button className={page==='alunos'?'active':''} onClick={()=>setPage('alunos')}><Users/>Alunos</button>
      <button className={page==='agenda'?'active':''} onClick={()=>setPage('agenda')}><CalendarDays/>Agenda de provas</button>
    </nav><div className="user"><b>{profile?.full_name||session.user.email}</b><span>{profile?.role||'Equipe'}</span><button onClick={logout}><LogOut/> Sair</button></div></aside>
    <main className="content"><header><div><span className="eyebrow">CFC GRUPO UNIÃO</span><h1>{page==='painel'?'Painel':page==='alunos'?'Alunos':'Agenda de provas'}</h1></div><div className="header-user">{profile?.full_name||session.user.email}</div></header>
    {notice&&<div className="notice-bar" onClick={()=>setNotice('')}>{notice} <X size={16}/></div>}
    {loading?<p>Carregando...</p>:null}
    {page==='painel'&&<><div className="stats"><div className="stat"><span>Total de alunos</span><b>{students.length}</b></div>{Object.entries(STATUS).map(([k,v])=><div className="stat" key={k}><span>{v}</span><b>{counts[k]||0}</b></div>)}</div><section className="panel"><h2><CalendarDays/> Próximas provas</h2>{sessions.filter(s=>new Date(s.scheduled_at)>=new Date()).slice(0,6).map(s=><button className="list-row" key={s.id} onClick={()=>{setSelectedSession(s);setPage('agenda')}}><b>{new Date(s.scheduled_at).toLocaleString('pt-BR')}</b><span>{s.location} · {s.category.toUpperCase()}</span></button>)}</section></>}
    {page==='alunos'&&<section className="panel"><div className="toolbar"><div><h2><GraduationCap/> Cadastro de alunos</h2><p>Pesquise, cadastre e edite os alunos.</p></div><button className="primary" onClick={()=>setStudentForm({...emptyStudent})}><Plus/> Novo aluno</button></div><div className="search"><Search/><input placeholder="Buscar por nome ou RENACH" value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="table-wrap"><table><thead><tr><th>Aluno</th><th>RENACH</th><th>Categoria</th><th>Status</th><th></th></tr></thead><tbody>{filtered.map(s=><tr key={s.id}><td><b>{s.full_name}</b><small>{s.instructor_name||'Sem instrutor'}</small></td><td>{s.renach}</td><td>{s.category}</td><td><span className={'pill '+s.status}>{STATUS[s.status]||s.status}</span></td><td><button className="icon-btn" onClick={()=>setStudentForm({...s})}><Pencil/></button></td></tr>)}</tbody></table></div></section>}
    {page==='agenda'&&<section className="panel"><div className="toolbar"><div><h2><CalendarDays/> Datas de prova</h2><p>Abra uma data para consultar e atualizar os alunos.</p></div>{admin&&<button className="primary" onClick={()=>setSessionForm({scheduled_at:'',category:'carro',location:'',notes:''})}><Plus/> Nova data</button>}</div><div className="session-grid">{sessions.map(s=><button className={'session-card '+(selectedSession?.id===s.id?'selected':'')} key={s.id} onClick={()=>setSelectedSession(s)}><b>{new Date(s.scheduled_at).toLocaleString('pt-BR')}</b><span>{s.category.toUpperCase()} · {s.location}</span><small>{appointments.filter(a=>a.session_id===s.id&&a.status!=='cancelada').length} aluno(s)</small></button>)}</div>
      {selectedSession&&<div className="session-detail"><h3>{new Date(selectedSession.scheduled_at).toLocaleString('pt-BR')} — {selectedSession.location}</h3><div className="toolbar"><p>Alunos desta data</p>{admin&&<select defaultValue="" onChange={e=>{if(e.target.value)addStudentToSession(e.target.value);e.target.value='';}}><option value="">Adicionar aluno...</option>{students.filter(s=>['aguardando_agendamento','reagendar','reprovado'].includes(s.status)).map(s=><option value={s.id} key={s.id}>{s.full_name} · {s.renach}</option>)}</select>}</div>
      {appointments.filter(a=>a.session_id===selectedSession.id).map(a=><div className="appointment" key={a.id}><div><b>{a.student?.full_name||'Aluno'}</b><small>RENACH {a.student?.renach||'—'} · {a.student?.category||''}</small></div><select value={a.status==='ausente'?'ausente':a.result|| (a.status==='realizada'?'compareceu':'agendado')} disabled={!admin} onChange={e=>updateSituation(a,e.target.value)}>{SITUATIONS.map(v=><option value={v} key={v}>{SITUATION_LABEL[v]}</option>)}</select></div>)}
      </div>}</section>}
    {studentForm&&<div className="modal-backdrop"><form className="modal" onSubmit={saveStudent}><div className="toolbar"><h2>{studentForm.id?'Editar aluno':'Novo aluno'}</h2><button type="button" className="icon-btn" onClick={()=>setStudentForm(null)}><X/></button></div><label>Nome completo<input required value={studentForm.full_name} onChange={e=>setStudentForm({...studentForm,full_name:e.target.value})}/></label><label>RENACH<input required value={studentForm.renach} onChange={e=>setStudentForm({...studentForm,renach:e.target.value})}/></label><div className="two"><label>Categoria<select value={studentForm.category} onChange={e=>setStudentForm({...studentForm,category:e.target.value})}><option>A</option><option>B</option><option>AB</option></select></label><label>Data de cadastro<input type="date" value={studentForm.registered_on} onChange={e=>setStudentForm({...studentForm,registered_on:e.target.value})}/></label></div><label>Instrutor<input value={studentForm.instructor_name||''} onChange={e=>setStudentForm({...studentForm,instructor_name:e.target.value})}/></label><label>Observações<textarea value={studentForm.notes||''} onChange={e=>setStudentForm({...studentForm,notes:e.target.value})}/></label><div className="modal-actions"><button type="button" className="secondary" onClick={()=>setStudentForm(null)}>Cancelar</button><button className="primary"><Check/> Salvar</button></div></form></div>}
    {sessionForm&&<div className="modal-backdrop"><form className="modal" onSubmit={saveSession}><div className="toolbar"><h2>Nova data de prova</h2><button type="button" className="icon-btn" onClick={()=>setSessionForm(null)}><X/></button></div><label>Data e horário<input type="datetime-local" required value={sessionForm.scheduled_at} onChange={e=>setSessionForm({...sessionForm,scheduled_at:e.target.value})}/></label><label>Categoria<select value={sessionForm.category} onChange={e=>setSessionForm({...sessionForm,category:e.target.value})}><option value="carro">Carro</option><option value="moto">Moto</option></select></label><label>Local<input required value={sessionForm.location} onChange={e=>setSessionForm({...sessionForm,location:e.target.value})}/></label><label>Observações<textarea value={sessionForm.notes} onChange={e=>setSessionForm({...sessionForm,notes:e.target.value})}/></label><div className="modal-actions"><button type="button" className="secondary" onClick={()=>setSessionForm(null)}>Cancelar</button><button className="primary"><Check/> Salvar data</button></div></form></div>}
    </main>
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
