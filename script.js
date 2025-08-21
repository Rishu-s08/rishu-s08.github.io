// Enhanced script: typed text, canvas particles, radial anim, modal, filters
// typed intro (simple)
(function typedIntro(){
  const el = document.querySelector('.typed');
  if(!el) return;
  const full = el.innerText;
  el.innerText = '';
  let i=0;
  const iv = setInterval(()=>{
    el.innerText = full.slice(0, i+1);
    i++;
    if(i>=full.length) clearInterval(iv);
  },18);
})();

// simple particle field on canvas
(function canvasParticles(){
  const canvas = document.getElementById('bgCanvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  function resize(){ canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight; }
  window.addEventListener('resize', resize); resize();
  const particles = [];
  for(let i=0;i<55;i++){ particles.push({x:Math.random()*canvas.width,y:Math.random()*canvas.height,r:Math.random()*1.6+0.6,dx:(Math.random()-0.5)*0.2,dy:(Math.random()-0.5)*0.2}) }
  function tick(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    particles.forEach(p=>{
      p.x += p.dx; p.y += p.dy;
      if(p.x<0) p.x=canvas.width; if(p.x>canvas.width) p.x=0;
      if(p.y<0) p.y=canvas.height; if(p.y>canvas.height) p.y=0;
      const g = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*12);
      g.addColorStop(0,'rgba(167,139,250,0.12)'); g.addColorStop(1,'rgba(96,165,250,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x,p.y,p.r*6,0,Math.PI*2); ctx.fill();
    });
    requestAnimationFrame(tick);
  }
  tick();
})();

// radial skill fills animate on scroll
document.querySelectorAll('.radial').forEach(r=>{
  const pct = +r.getAttribute('data-percent') || 0;
  const circle = r.querySelector('.circle');
  const length = 100; // dasharray used in CSS
  const offset = length - (length * pct) / 100;
  // reveal with intersection observer
  const ob = new IntersectionObserver((entries)=>{
    entries.forEach(en=>{
      if(en.isIntersecting){
        circle.style.strokeDashoffset = offset;
      }
    });
  },{threshold:0.25});
  ob.observe(r);
});

// project filter chips
document.querySelectorAll('.chip').forEach(ch=>{
  ch.addEventListener('click', ()=>{
    document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
    ch.classList.add('active');
    const f = ch.getAttribute('data-filter');
    document.querySelectorAll('.projects-grid .project').forEach(p=>{
      if(f==='all') p.style.display = 'block';
      else {
        const tags = p.getAttribute('data-tags') || '';
        p.style.display = tags.includes(f) ? 'block' : 'none';
      }
    });
  });
});

// modal open/close
document.querySelectorAll('[data-open]').forEach(btn=>{
  btn.addEventListener('click', (e)=>{
    e.preventDefault();
    // Close all modals first
    document.querySelectorAll('.modal').forEach(m=>{
      m.setAttribute('aria-hidden','true');
    });
    // Open the selected modal
    const id = btn.getAttribute('data-open');
    const modal = document.getElementById(id);
    if(modal) modal.setAttribute('aria-hidden','false');
    // Prevent background scroll
    document.body.style.overflow = 'hidden';
  });
});
document.querySelectorAll('[data-close]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    btn.closest('.modal').setAttribute('aria-hidden','true');
    // Restore background scroll if no modal is open
    setTimeout(()=>{
      const anyOpen = Array.from(document.querySelectorAll('.modal')).some(m=>m.getAttribute('aria-hidden')==='false');
      if(!anyOpen) document.body.style.overflow = '';
    }, 10);
  });
});
document.querySelectorAll('.modal').forEach(m=>{
  m.addEventListener('click', (e)=>{
    if(e.target === m) {
      m.setAttribute('aria-hidden','true');
      // Restore background scroll if no modal is open
      setTimeout(()=>{
        const anyOpen = Array.from(document.querySelectorAll('.modal')).some(m=>m.getAttribute('aria-hidden')==='false');
        if(!anyOpen) document.body.style.overflow = '';
      }, 10);
    }
  });
});

// small enhancements reuse original functions
(function reuseInit(){
  try{ /* year and mobile menu functions exist in script.js already */ }catch(e){}
})();


// Smooth scroll for nav links
document.querySelectorAll('.nav-links a').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    document.querySelector(a.getAttribute('href')).scrollIntoView({ behavior: 'smooth' });
    if (window.innerWidth < 900) { closeMenu(); }
  });
});

// nav toggle for mobile
function toggleMenu() {
  const links = document.querySelector('.nav-links');
  if (links.style.display === 'flex') { closeMenu(); }
  else { links.style.display = 'flex'; links.style.flexDirection = 'column'; links.style.position = 'absolute'; links.style.right = '24px'; links.style.top = '64px'; links.style.background = 'rgba(2,6,23,0.85)'; links.style.padding = '10px'; links.style.borderRadius = '12px'; }
}
function closeMenu() { const links = document.querySelector('.nav-links'); links.style.display = 'none'; }

// current year
document.getElementById('year').innerText = new Date().getFullYear();

// simple reveal on scroll
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) e.target.classList.add('in');
  });
}, { threshold: 0.12 });
document.querySelectorAll('.panel, .project, .skill, .hero-card').forEach(el => observer.observe(el));

const blob = document.querySelector('.hero-illustration svg');
if (blob) {
  window.addEventListener('mousemove', (ev) => {
    const x = (ev.clientX - window.innerWidth / 2) * 0.02;
    const y = (ev.clientY - window.innerHeight / 2) * 0.02;
    blob.style.transform = `translate(${x}px, ${y}px)`;
  });
}

// when form is submitted, show nice message (works even if form action isn't configured)
const form = document.getElementById('contactForm');
if (form) {
  form.addEventListener('submit', async (e) => {
    // allow native submit if real action present (not the placeholder)
    const action = form.getAttribute('action') || '';
    if (action.includes('your-form-id')) {
      e.preventDefault();
      // simulate success message
      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      btn.innerText = 'Sending...';
      setTimeout(() => {
        btn.disabled = false;
        btn.innerText = 'Send';
        alert('Thank you! Your message would be sent once you replace the form action with your Formspree or Getform endpoint.');
        form.reset();
      }, 900);
    }
  });
}

// tiny parallax blob movement

