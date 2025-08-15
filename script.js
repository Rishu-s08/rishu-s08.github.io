// Smooth scroll for nav links
document.querySelectorAll('.nav-links a').forEach(a=>{
  a.addEventListener('click', e=>{
    e.preventDefault();
    document.querySelector(a.getAttribute('href')).scrollIntoView({behavior:'smooth'});
    if(window.innerWidth < 900){ closeMenu(); }
  });
});

// nav toggle for mobile
function toggleMenu(){
  const links = document.querySelector('.nav-links');
  if(links.style.display === 'flex') { closeMenu(); }
  else { links.style.display = 'flex'; links.style.flexDirection = 'column'; links.style.position='absolute'; links.style.right='24px'; links.style.top='64px'; links.style.background='rgba(2,6,23,0.85)'; links.style.padding='10px'; links.style.borderRadius='12px'; }
}
function closeMenu(){ const links = document.querySelector('.nav-links'); links.style.display='none'; }

// current year
document.getElementById('year').innerText = new Date().getFullYear();

// simple reveal on scroll
const observer = new IntersectionObserver((entries)=>{
  entries.forEach(e=>{
    if(e.isIntersecting) e.target.classList.add('in');
  });
},{threshold:0.12});
document.querySelectorAll('.panel, .project, .skill, .hero-card').forEach(el=>observer.observe(el));

// when form is submitted, show nice message (works even if form action isn't configured)
const form = document.getElementById('contactForm');
form.addEventListener('submit', async (e)=>{
  // allow native submit if real action present (not the placeholder)
  const action = form.getAttribute('action') || '';
  if(action.includes('your-form-id')){
    e.preventDefault();
    // simulate success message
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.innerText = 'Sending...';
    setTimeout(()=>{
      btn.disabled = false;
      btn.innerText = 'Send';
      alert('Thank you! Your message would be sent once you replace the form action with your Formspree or Getform endpoint.');
      form.reset();
    }, 900);
  }
});

// tiny parallax blob movement
const blob = document.querySelector('.hero-illustration svg');
if(blob){
  window.addEventListener('mousemove', (ev)=>{
    const x = (ev.clientX - window.innerWidth/2) * 0.02;
    const y = (ev.clientY - window.innerHeight/2) * 0.02;
    blob.style.transform = `translate(${x}px, ${y}px)`;
  });
}
