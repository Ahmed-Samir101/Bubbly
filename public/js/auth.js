// DOM Elements
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const signupBtn = document.getElementById('signup-btn');
const loginBtn = document.getElementById('login-btn');

// Tab buttons for switching forms
const loginTab = document.getElementById('login-tab');
const signupTab = document.getElementById('signup-tab');

// Toggle between login and signup forms
signupTab.addEventListener('click', function(e) {
  e.preventDefault();
  loginForm.style.display = 'none';
  signupForm.style.display = '';
  loginTab.classList.remove('active');
  signupTab.classList.add('active');
});

loginTab.addEventListener('click', function(e) {
  e.preventDefault();
  signupForm.style.display = 'none';
  loginForm.style.display = '';
  signupTab.classList.remove('active');
  loginTab.classList.add('active');
});

// Generate a unique user ID
function generateUserId() {
  return 'user_' + Math.random().toString(36).substr(2, 9);
}

// Handle user signup
signupBtn.addEventListener('click', async function() {
  const username = document.getElementById('signup-username').value.trim();
  const password = document.getElementById('signup-password').value;
  const confirmPassword = document.getElementById('signup-confirm-password').value;
  
  // Validation
  if (!username || !password || !confirmPassword) {
    alert('Please fill in all fields');
    return;
  }
  
  if (password !== confirmPassword) {
    alert('Passwords do not match');
    return;
  }
  
  console.log('Starting signup for:', username);
  
  // Disable the button
  signupBtn.disabled = true;
  signupBtn.textContent = 'Creating account...';
  
  try {
    // Register user with API
    const response = await fetch('/api/users/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    console.log('Signup response:', data);
    
    if (!data.success) {
      alert(`Failed to create account: ${data.error}`);
      console.error('Registration error:', data);
      signupBtn.disabled = false;
      signupBtn.textContent = 'Sign Up';
      return;
    }
    
    // Ensure we have a valid user object
    if (!data.user || !data.user.id || !data.user.username) {
      console.error('Invalid user data received:', data);
      alert('Server returned invalid user data. Please try again.');
      signupBtn.disabled = false;
      signupBtn.textContent = 'Sign Up';
      return;
    }
    
    // Store user in localStorage for session
    localStorage.setItem('bubbly_current_user', JSON.stringify(data.user));
    console.log('User saved to localStorage:', data.user);
    
    // Verify it was saved correctly
    const storedUser = localStorage.getItem('bubbly_current_user');
    console.log('Verification - stored user:', storedUser);
    
    // Show user their ID before redirecting
    alert(`Your account has been created!\n\nUsername: ${data.user.username}\nYour ID: ${data.user.id}\n\nYou can share your ID with friends so they can add you.`);
    
    // Redirect to chat page
    window.location.href = '/';
    
  } catch (error) {
    console.error('Registration error:', error);
    alert('Failed to create account: ' + error.message);
    signupBtn.disabled = false;
    signupBtn.textContent = 'Sign Up';
  }
});

// Handle user login
loginBtn.addEventListener('click', async function() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  
  // Validation
  if (!username || !password) {
    alert('Please fill in all fields');
    return;
  }
  
  console.log('Starting login for:', username);
  
  // Disable the button
  loginBtn.disabled = true;
  loginBtn.textContent = 'Logging in...';
  
  try {
    // Login with API
    const response = await fetch('/api/users/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    console.log('Login response:', data);
    
    if (!data.success) {
      alert(`Login failed: ${data.error}`);
      console.error('Login error:', data);
      loginBtn.disabled = false;
      loginBtn.textContent = 'Login';
      return;
    }
    
    // Ensure we have a valid user object
    if (!data.user || !data.user.id || !data.user.username) {
      console.error('Invalid user data received:', data);
      alert('Server returned invalid user data. Please try again.');
      loginBtn.disabled = false;
      loginBtn.textContent = 'Login';
      return;
    }
    
    // Store user in localStorage for session
    localStorage.setItem('bubbly_current_user', JSON.stringify(data.user));
    console.log('User saved to localStorage:', data.user);
    
    // Verify it was saved correctly
    const storedUser = localStorage.getItem('bubbly_current_user');
    console.log('Verification - stored user:', storedUser);
    
    // Redirect to chat page
    window.location.href = '/';
    
  } catch (error) {
    console.error('Login error:', error);
    alert('Login failed: ' + error.message);
    loginBtn.disabled = false;
    loginBtn.textContent = 'Login';
  }
});

// Check if user is already logged in
window.addEventListener('load', function() {
  const currentUser = localStorage.getItem('bubbly_current_user');
  if (currentUser) {
    window.location.href = '/';
  }
});