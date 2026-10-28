/* Vessel of Honour Learning Hub â€” cloud-connected version.
   Access is enforced by Supabase Auth + database Row Level Security (see supabase.sql). */
const CONFIG_READY = window.VOH_SUPABASE_URL && window.VOH_SUPABASE_ANON_KEY &&
  !window.VOH_SUPABASE_URL.includes("PASTE_YOUR") && !window.VOH_SUPABASE_ANON_KEY.includes("PASTE_YOUR");
const supabaseClient = CONFIG_READY && window.supabase
  ? window.supabase.createClient(window.VOH_SUPABASE_URL, window.VOH_SUPABASE_ANON_KEY)
  : null;

const $ = id => document.getElementById(id);
let currentUser = null, currentRole = "student", currentView = "overview", posts = [], authMode = "login", toastTimer;

function escapeHTML(value="") { return String(value).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch])); }
function futureDate(days) { const d = new Date(); d.setDate(d.getDate()+days); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function prettyDate(value) { if (!value) return "No deadline"; return new Date(`${value}T12:00:00`).toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"}); }
function shortDate(value) { const d = new Date(`${value}T12:00:00`); return {day:d.toLocaleDateString(undefined,{day:"2-digit"}),month:d.toLocaleDateString(undefined,{month:"short"})}; }
function typeLabel(type) { return type === "project" ? "Project work" : type === "announcement" ? "Announcement" : "Assignment"; }
function symbol(type) { return type === "project" ? "â–§" : type === "announcement" ? "â—‰" : "â–¤"; }
function showToast(message) { const toast=$("toast"); toast.textContent=message; toast.classList.add("show"); clearTimeout(toastTimer); toastTimer=setTimeout(()=>toast.classList.remove("show"),2800); }
function setAuthMessage(message, kind="") { const el=$("authMessage"); el.textContent=message; el.className=`auth-note ${kind}`; }
function showAuth() { $("authScreen").hidden=false; $("appScreen").hidden=true; }
function showApp() { $("authScreen").hidden=true; $("appScreen").hidden=false; }
function setAuthMode(mode) {
  authMode=mode;
  $("loginTab").classList.toggle("active",mode==="login");
  $("signupTab").classList.toggle("active",mode==="signup");
  $("authSubmit").textContent=mode==="login"?"Sign in":"Create student account";
  $("authPassword").autocomplete=mode==="login"?"current-password":"new-password";
  setAuthMessage(mode==="login"?"Sign in with your school account.":"New accounts receive student access. Ask a school administrator to approve teacher access.");
}

async function loadProfileAndPosts() {
  const {data: profile, error: profileError} = await supabaseClient.from("profiles").select("role").eq("id",currentUser.id).maybeSingle();
  if (profileError) throw profileError;
  if (!profile) throw new Error("Your user profile is not ready. Contact the school app administrator.");
  currentRole = profile.role;
  await refreshPosts();
  showApp();
  render();
}
async function refreshPosts() {
  $("statusLine").textContent="Loading shared school postsâ€¦";
  const {data,error}=await supabaseClient.from("posts").select("id,type,subject,class_name,title,description,due_date,created_at").order("created_at",{ascending:false});
  if(error) throw error;
  posts=(data||[]).map(p=>({...p,className:p.class_name,due:p.due_date,created:p.created_at}));
  $("statusLine").textContent="";
}
async function initialiseSession() {
  if (!supabaseClient) {
    showAuth();
    setAuthMessage("First connect your Supabase project: add the Project URL and anon/publishable key in config.js, then run supabase.sql.", "error");
    $("authSubmit").disabled=true;
    return;
  }
  $("authSubmit").disabled=false;
  showAuth();

  supabaseClient.auth.onAuthStateChange((event,sessionNow)=>{
    if (event === "PASSWORD_RECOVERY") {
      showPasswordReset();
      return;
    }
    if(!sessionNow) { currentUser=null; posts=[]; showAuth(); }
  });

  const {data:{session},error}=await supabaseClient.auth.getSession();
  if(error){setAuthMessage(error.message,"error");return;}
  if(session?.user) {
    currentUser=session.user;
    try { await loadProfileAndPosts(); }
    catch(e) { setAuthMessage(e.message||"Could not load your school account.","error"); await supabaseClient.auth.signOut(); }
  }
}

function showPasswordReset() {
  showAuth();
  $("authTabs").hidden = true;
  $("authForm").hidden = true;
  $("resetPasswordForm").hidden = false;
  setAuthMessage("Choose a new password for your account.");
}

$("forgotPasswordButton").addEventListener("click", async () => {
  if (!supabaseClient) {
    setAuthMessage("Supabase is not connected.", "error");
    return;
  }

  const email = $("authEmail").value.trim();

  if (!email) {
    setAuthMessage("Enter your email address first.", "error");
    $("authEmail").focus();
    return;
  }

  const button = $("forgotPasswordButton");
  button.disabled = true;

  try {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname
    });

    if (error) throw error;

    setAuthMessage(
      "If an account exists for this email, a password-reset email has been sent. Check your inbox and spam folder.",
      "success"
    );
  } catch (error) {
    setAuthMessage(error.message || "Could not request a password reset.", "error");
  } finally {
    button.disabled = false;
  }
});

$("resetPasswordForm").addEventListener("submit", async event => {
  event.preventDefault();

  if (!supabaseClient) {
    setAuthMessage("Supabase is not connected.", "error");
    return;
  }

  const password = $("newPassword").value;

  if (password.length < 6) {
    setAuthMessage("Your password must contain at least 6 characters.", "error");
    return;
  }

  const button = $("savePasswordButton");
  button.disabled = true;

  try {
    const { data: { session }, error: sessionError } =
      await supabaseClient.auth.getSession();

    if (sessionError) throw sessionError;

    if (!session?.user) {
      throw new Error(
        "Your password-reset session is missing or expired. Request a new password-reset email and open its newest link."
      );
    }

    const { error } = await supabaseClient.auth.updateUser({ password });

    if (error) throw error;

    await supabaseClient.auth.signOut();

    $("resetPasswordForm").hidden = true;
    $("authTabs").hidden = false;
    $("authForm").hidden = false;
    $("authPassword").value = "";
    $("newPassword").value = "";

    setAuthMode("login");
    setAuthMessage("Password changed successfully. Sign in with your new password.", "success");
  } catch (error) {
    setAuthMessage(error.message || "Could not change your password.", "error");
  } finally {
    button.disabled = false;
  }
});
$("loginTab").addEventListener("click",()=>setAuthMode("login"));
$("signupTab").addEventListener("click",()=>setAuthMode("signup"));
$("authForm").addEventListener("submit",async event=>{
  event.preventDefault();
  if(!supabaseClient){setAuthMessage("Connect Supabase first by completing config.js and the SQL setup.","error");return;}
  const email=$("authEmail").value.trim(), password=$("authPassword").value;
  $("authSubmit").disabled=true; $("authSubmit").textContent="Please waitâ€¦";
  try {
    if(authMode==="signup") {
      const {data,error}=await supabaseClient.auth.signUp({email,password});
      if(error) throw error;
      if(data.session) {
        currentUser=data.user;
        await loadProfileAndPosts();
        showToast("Account created. You have student access.");
      } else {
        setAuthMessage("Account created. Check your email to confirm it, then sign in. If confirmation is disabled by your school admin, sign in now.","success");
      }
    } else {
      const {data,error}=await supabaseClient.auth.signInWithPassword({email,password});
      if(error) throw error;
      currentUser=data.user;
      await loadProfileAndPosts();
      showToast("Signed in successfully.");
    }
  } catch(error) {
    setAuthMessage(error.message||"Unable to complete sign-in. Please try again.","error");
  } finally {
    $("authSubmit").disabled=false;
    $("authSubmit").textContent=authMode==="login"?"Sign in":"Create student account";
  }
});

$("signOutButton").addEventListener("click",async()=>{
  if(!supabaseClient)return;
  const {error}=await supabaseClient.auth.signOut();
  if(error) showToast(error.message); else { currentUser=null; posts=[]; showAuth(); setAuthMode("login"); showToast("Signed out."); }
});
document.querySelectorAll(".nav-item").forEach(button=>button.addEventListener("click",()=>{
  currentView=button.dataset.view; render(); $("sidebar").classList.remove("open");
}));
$("subjectFilter").addEventListener("change",renderPosts);
$("menuButton").addEventListener("click",()=>$("sidebar").classList.toggle("open"));
$("createButton").addEventListener("click",()=>$("postDialog").showModal());
$("closeDialog").addEventListener("click",()=>$("postDialog").close());
$("cancelDialog").addEventListener("click",()=>$("postDialog").close());

$("postForm").addEventListener("submit",async event=>{
  event.preventDefault();
  if(currentRole!=="teacher"){showToast("Only approved teachers can publish posts.");return;}
  const type=$("postType").value, due=$("postDue").value;
  if(type!=="announcement" && due && due<futureDate(0)){showToast("Choose today or a future due date.");return;}
  const post={type,subject:$("postSubject").value,class_name:$("postClass").value.trim(),title:$("postTitle").value.trim(),description:$("postDescription").value.trim(),due_date:due||null,created_by:currentUser.id};
  if(!post.title||!post.description||!post.class_name){showToast("Please complete all required fields.");return;}
  const publish=$("publishButton"); publish.disabled=true; publish.textContent="Publishingâ€¦";
  try {
    const {error}=await supabaseClient.from("posts").insert(post);
    if(error) throw error;
    $("postForm").reset(); $("postDialog").close();
    currentView=type==="project"?"projects":type==="announcement"?"announcements":"assignments";
    await refreshPosts(); render(); showToast("Published online for signed-in school users.");
  } catch(error) { showToast(error.message||"Could not publish the post."); }
  finally { publish.disabled=false; publish.textContent="Publish post"; }
});

$("postList").addEventListener("click",async event=>{
  const button=event.target.closest('button[data-action="delete"]');
  if(!button||currentRole!=="teacher")return;
  const post=posts.find(p=>p.id===button.dataset.id);
  if(!post||!confirm(`Delete "${post.title}" for everyone?`))return;
  button.disabled=true;
  const {error}=await supabaseClient.from("posts").delete().eq("id",post.id);
  if(error){showToast(error.message||"Could not delete post.");button.disabled=false;return;}
  await refreshPosts();render();showToast("Post deleted for everyone.");
});

function visiblePosts(){
  const subject=$("subjectFilter").value;
  let list=posts.filter(p=>subject==="all"||p.subject===subject);
  if(currentView==="assignments")list=list.filter(p=>p.type==="assignment");
  if(currentView==="projects")list=list.filter(p=>p.type==="project");
  if(currentView==="announcements")list=list.filter(p=>p.type==="announcement");
  return list;
}
function renderStats(){
  $("openCount").textContent=posts.filter(p=>p.type==="assignment").length;
  $("projectCount").textContent=posts.filter(p=>p.type==="project").length;
  const today=futureDate(0),week=futureDate(7);
  $("dueCount").textContent=posts.filter(p=>p.due&&p.due>=today&&p.due<=week&&p.type!=="announcement").length;
}
function renderPosts(){
  const list=visiblePosts();
  $("postList").innerHTML=list.map(p=>{
    const overdue=p.due&&p.due<futureDate(0)&&p.type!=="announcement";
    const action=currentRole==="teacher"?`<div class="post-actions"><button class="small-action" data-action="delete" data-id="${escapeHTML(p.id)}">Delete post for everyone</button></div>`:"";
    return `<article class="post-card"><div class="post-symbol ${escapeHTML(p.type)}">${symbol(p.type)}</div><div class="post-body"><div class="post-topline"><h3 class="post-title">${escapeHTML(p.title)}</h3><span class="type-pill ${escapeHTML(p.type)}">${typeLabel(p.type)}</span></div><p class="post-desc">${escapeHTML(p.description)}</p><div class="post-meta"><span>â–£ ${escapeHTML(p.subject)}</span><span>â™™ ${escapeHTML(p.className)}</span><span class="${overdue?"overdue":"due"}">â—· ${p.type==="announcement"?"School update":(overdue?"Overdue Â· ":"Due Â· ")+prettyDate(p.due)}</span></div>${action}</div></article>`;
  }).join("");
  $("emptyState").hidden=list.length!==0;
  $("postList").hidden=list.length===0;
}
function renderDeadlines(){
  const items=posts.filter(p=>p.due&&p.type!=="announcement"&&p.due>=futureDate(0)).sort((a,b)=>a.due.localeCompare(b.due)).slice(0,4);
  $("deadlineList").innerHTML=items.length?items.map(p=>{const d=shortDate(p.due);return `<div class="deadline-item"><div class="date-box"><strong>${d.day}</strong><span>${d.month}</span></div><div class="deadline-copy"><strong>${escapeHTML(p.title)}</strong><p>${escapeHTML(p.subject)} Â· ${escapeHTML(p.className)}</p></div></div>`;}).join(""):`<div class="deadline-empty">No upcoming deadlines. You're all caught up!</div>`;
}
function render(){
  const teacher=currentRole==="teacher";
  $("roleLabel").textContent=teacher?"Teacher":"Student";
  $("avatar").textContent=teacher?"T":"S";
  $("userEmail").textContent=currentUser?.email||"";
  $("welcomeTitle").innerHTML=teacher?'Welcome back, teacher <span>âœ¦</span>':'Welcome, learner <span>âœ¦</span>';
  $("welcomeText").textContent=teacher?"Share clear instructions and keep your learners on track.":"Your classwork, deadlines and school updates â€” all in one place.";
  $("createButton").hidden=!teacher;
  $("dateLabel").textContent=new Date().toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"}).toUpperCase();
  const names={overview:["Overview","Latest learning tasks","Work shared by your school appears here."],assignments:["Assignments","Assignments & homework","Review tasks and due dates."],projects:["Project work","Project work","Explore project topics and instructions."],announcements:["Announcements","School announcements","Keep up with important school updates."]};
  const info=names[currentView];$("crumb").textContent=info[0];$("sectionTitle").textContent=info[1];$("sectionSubtitle").textContent=info[2];
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===currentView));
  renderStats();renderPosts();renderDeadlines();
}
$("year").textContent=new Date().getFullYear();
setAuthMode("login");
initialiseSession();
