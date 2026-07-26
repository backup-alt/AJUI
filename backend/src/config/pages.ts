export const RESET_PASSWORD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Password - AGB</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f6f8; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); padding: 40px 32px; max-width: 420px; width: 90%; text-align: center; }
    .logo { width: 80px; height: 80px; margin: 0 auto 16px; }
    h1 { font-size: 20px; color: #002263; margin-bottom: 4px; }
    .subtitle { font-size: 13px; color: #98a2b3; margin-bottom: 28px; text-transform: uppercase; letter-spacing: 0.05em; }
    .form-group { text-align: left; margin-bottom: 16px; }
    label { display: block; font-size: 13px; font-weight: 600; color: #344054; margin-bottom: 6px; }
    input { width: 100%; padding: 12px 14px; border: 1px solid #d0d5dd; border-radius: 8px; font-size: 15px; outline: none; transition: border-color 0.2s; }
    input:focus { border-color: #002263; }
    .btn { width: 100%; padding: 12px; background: #002263; color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
    .btn:hover { background: #001a4d; }
    .btn:disabled { background: #98a2b3; cursor: not-allowed; }
    .msg { margin-top: 16px; font-size: 14px; padding: 12px; border-radius: 8px; }
    .msg.success { background: #ecfdf3; color: #067647; }
    .msg.error { background: #fef3f2; color: #b42318; }
    .link { margin-top: 20px; font-size: 13px; color: #667085; }
    .link a { color: #002263; text-decoration: none; font-weight: 500; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#c9a227"/><stop offset="100%" style="stop-color:#e8c840"/></linearGradient></defs>
        <path d="M100 20 L140 70 Q160 95 140 120 L120 140 Q110 150 100 145 Q90 150 80 140 L60 120 Q40 95 60 70 Z" fill="url(#g)" opacity="0.9"/>
        <text x="100" y="180" text-anchor="middle" fill="#c9a227" font-size="28" font-weight="700" font-family="sans-serif">ANNAI</text>
        <text x="100" y="198" text-anchor="middle" fill="#c9a227" font-size="11" font-weight="400" font-family="sans-serif" letter-spacing="2">GOLDEN BUILDERS</text>
      </svg>
    </div>
    <h1>Reset Your Password</h1>
    <p class="subtitle">AGB Operations Workspace</p>
    <div id="form-view">
      <div class="form-group">
        <label for="password">New Password</label>
        <input type="password" id="password" placeholder="Enter new password" autocomplete="new-password">
      </div>
      <div class="form-group">
        <label for="confirm">Confirm Password</label>
        <input type="password" id="confirm" placeholder="Confirm new password" autocomplete="new-password">
      </div>
      <button class="btn" id="submit-btn" onclick="handleReset()">Reset Password</button>
      <div id="msg" class="msg" style="display:none"></div>
    </div>
    <div id="success-view" style="display:none">
      <div class="msg success">Password updated successfully!</div>
      <p style="margin-top:16px;font-size:14px;color:#475467;">You can now log in with your new password in the AGB app.</p>
    </div>
    <div id="error-view" style="display:none">
      <div class="msg error" id="error-msg"></div>
    </div>
  </div>
  <script>
    var API = window.location.origin + '/api';
    var params = new URLSearchParams(window.location.search);
    var token = params.get('token');
    if (!token) showError('Invalid or missing reset link. Please request a new one from the app.');
    function showError(m){document.getElementById('form-view').style.display='none';document.getElementById('success-view').style.display='none';document.getElementById('error-view').style.display='block';document.getElementById('error-msg').textContent=m;}
    async function handleReset(){
      var pw=document.getElementById('password').value,cf=document.getElementById('confirm').value,msg=document.getElementById('msg'),btn=document.getElementById('submit-btn');
      if(!pw||pw.length<8){msg.className='msg error';msg.textContent='Password must be at least 8 characters.';msg.style.display='block';return;}
      if(pw!==cf){msg.className='msg error';msg.textContent='Passwords do not match.';msg.style.display='block';return;}
      btn.disabled=true;btn.textContent='Resetting...';
      try{var r=await fetch(API+'/auth/reset-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:token,password:pw})});var d=await r.json();
      if(r.ok&&d.success){document.getElementById('form-view').style.display='none';document.getElementById('success-view').style.display='block';}
      else{msg.className='msg error';msg.textContent=d.error||d.message||'Reset failed. The link may have expired.';msg.style.display='block';btn.disabled=false;btn.textContent='Reset Password';}
      }catch(e){msg.className='msg error';msg.textContent='Network error. Please try again.';msg.style.display='block';btn.disabled=false;btn.textContent='Reset Password';}
    }
  </script>
</body>
</html>`;

export const SIGNUP_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Complete Signup - AGB</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f6f8; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); padding: 40px 32px; max-width: 420px; width: 90%; text-align: center; }
    .logo { width: 80px; height: 80px; margin: 0 auto 16px; }
    h1 { font-size: 20px; color: #002263; margin-bottom: 4px; }
    .subtitle { font-size: 13px; color: #98a2b3; margin-bottom: 28px; text-transform: uppercase; letter-spacing: 0.05em; }
    .form-group { text-align: left; margin-bottom: 16px; }
    label { display: block; font-size: 13px; font-weight: 600; color: #344054; margin-bottom: 6px; }
    input { width: 100%; padding: 12px 14px; border: 1px solid #d0d5dd; border-radius: 8px; font-size: 15px; outline: none; transition: border-color 0.2s; }
    input:focus { border-color: #002263; }
    .btn { width: 100%; padding: 12px; background: #002263; color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
    .btn:hover { background: #001a4d; }
    .btn:disabled { background: #98a2b3; cursor: not-allowed; }
    .msg { margin-top: 16px; font-size: 14px; padding: 12px; border-radius: 8px; }
    .msg.success { background: #ecfdf3; color: #067647; }
    .msg.error { background: #fef3f2; color: #b42318; }
    .link { margin-top: 20px; font-size: 13px; color: #667085; }
    .link a { color: #002263; text-decoration: none; font-weight: 500; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#c9a227"/><stop offset="100%" style="stop-color:#e8c840"/></linearGradient></defs>
        <path d="M100 20 L140 70 Q160 95 140 120 L120 140 Q110 150 100 145 Q90 150 80 140 L60 120 Q40 95 60 70 Z" fill="url(#g)" opacity="0.9"/>
        <text x="100" y="180" text-anchor="middle" fill="#c9a227" font-size="28" font-weight="700" font-family="sans-serif">ANNAI</text>
        <text x="100" y="198" text-anchor="middle" fill="#c9a227" font-size="11" font-weight="400" font-family="sans-serif" letter-spacing="2">GOLDEN BUILDERS</text>
      </svg>
    </div>
    <h1>Complete Your Signup</h1>
    <p class="subtitle">AGB Operations Workspace</p>
    <div id="form-view">
      <div class="form-group">
        <label for="name">Full Name</label>
        <input type="text" id="name" placeholder="Enter your full name">
      </div>
      <div class="form-group">
        <label for="phone">Phone Number</label>
        <input type="tel" id="phone" placeholder="+91 XXXXXXXXXX">
      </div>
      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" id="password" placeholder="Create a password" autocomplete="new-password">
      </div>
      <div class="form-group">
        <label for="confirm">Confirm Password</label>
        <input type="password" id="confirm" placeholder="Confirm password" autocomplete="new-password">
      </div>
      <button class="btn" id="submit-btn" onclick="handleSignup()">Complete Signup</button>
      <div id="msg" class="msg" style="display:none"></div>
    </div>
    <div id="success-view" style="display:none">
      <div class="msg success">Signup complete!</div>
      <p style="margin-top:16px;font-size:14px;color:#475467;">You can now log in to the AGB app with your phone number and password.</p>
    </div>
  </div>
  <script>
    var API = window.location.origin + '/api';
    var params = new URLSearchParams(window.location.search);
    var token = params.get('token');
    if (!token) document.getElementById('form-view').innerHTML = '<div class="msg error">Invalid or missing invite link. Please contact your administrator.</div>';
    async function handleSignup(){
      var n=document.getElementById('name').value.trim(),ph=document.getElementById('phone').value.trim(),pw=document.getElementById('password').value,cf=document.getElementById('confirm').value,msg=document.getElementById('msg'),btn=document.getElementById('submit-btn');
      if(!n){showErr('Please enter your name.');return;}if(!ph){showErr('Please enter your phone number.');return;}
      if(!pw||pw.length<6){showErr('Password must be at least 6 characters.');return;}if(pw!==cf){showErr('Passwords do not match.');return;}
      btn.disabled=true;btn.textContent='Signing up...';
      try{var r=await fetch(API+'/auth/supervisor/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:token,name:n,phone:ph,password:pw})});var d=await r.json();
      if(r.ok&&d.success){document.getElementById('form-view').style.display='none';document.getElementById('success-view').style.display='block';}
      else{showErr(d.error||d.message||'Signup failed. The invite may have expired.');btn.disabled=false;btn.textContent='Complete Signup';}
      }catch(e){showErr('Network error. Please try again.');btn.disabled=false;btn.textContent='Complete Signup';}
    }
    function showErr(m){var msg=document.getElementById('msg');msg.className='msg error';msg.textContent=m;msg.style.display='block';}
  </script>
</body>
</html>`;
