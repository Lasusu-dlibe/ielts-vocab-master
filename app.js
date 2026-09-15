(() => {
  const toast = document.querySelector('#toast'); let toastTimer;
  const showToast = (message) => { toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2400); };
  document.querySelectorAll('[data-toast]').forEach((button) => button.addEventListener('click', () => showToast(button.dataset.toast)));
  document.querySelector('.banner-close')?.addEventListener('click', (event) => { event.currentTarget.closest('.app-banner').style.display = 'none'; });
  const menu = document.querySelector('.menu-toggle'); menu?.addEventListener('click', () => menu.classList.toggle('open'));
  document.querySelectorAll('.main-nav a').forEach((link) => link.addEventListener('click', () => menu?.classList.remove('open')));
  const quoteData = [['Mình thích nhất là mở lên biết ngay hôm nay cần học gì. Không còn cảm giác bị ngợp bởi cả một danh sách từ vựng dài nữa.','Minh Anh','IELTS 6.0 → 7.5'],['Sau 30 ngày, mình đã tạo được thói quen học đều. Những từ khó trước đây bây giờ xuất hiện trong đầu tự nhiên hơn rất nhiều.','Hoàng Nam','TOEIC 650 → 875'],['Các game ngắn khiến việc ôn từ bớt căng thẳng. Mỗi ngày chỉ 10 phút nhưng nhìn lại đã tích lũy được cả một kho từ.','Thảo Vy','SAT 1080 → 1330']]; let quoteIndex=0;
  const updateQuote=()=>{const [text,name,meta]=quoteData[quoteIndex]; document.querySelector('#quoteText').textContent=text; document.querySelector('#quoteName').textContent=name; document.querySelector('#quoteMeta').textContent=meta; document.querySelectorAll('.quote-dots i').forEach((dot,index)=>dot.classList.toggle('active',index===quoteIndex));};
  document.querySelector('#prevQuote')?.addEventListener('click',()=>{quoteIndex=(quoteIndex+quoteData.length-1)%quoteData.length;updateQuote();}); document.querySelector('#nextQuote')?.addEventListener('click',()=>{quoteIndex=(quoteIndex+1)%quoteData.length;updateQuote();});
  document.querySelectorAll('.roadmap-tabs button').forEach((tab)=>tab.addEventListener('click',()=>{document.querySelectorAll('.roadmap-tabs button').forEach((item)=>item.classList.remove('active'));tab.classList.add('active');showToast(`Đã chọn lộ trình ${tab.textContent}`);}));
  const observer=new IntersectionObserver((entries)=>entries.forEach((entry)=>{if(entry.isIntersecting)entry.target.classList.add('visible');}),{threshold:.12}); document.querySelectorAll('.reveal').forEach((el)=>observer.observe(el));
})();
