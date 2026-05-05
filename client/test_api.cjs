const axios = require('axios');

async function test() {
  const api = axios.create({
    baseURL: 'http://localhost:5000/api',
    headers: { 'Content-Type': 'application/json' }
  });

  api.interceptors.response.use(
    (response) => response.data,
    (error) => Promise.reject(error)
  );

  // We need a valid token to test, but we can just test if an invalid token returns a proper error
  // Wait, let's login first
  try {
    const loginRes = await api.post('/auth/login', { mobile: '9999999999', password: '123' });
    console.log('Login Res:', loginRes);
    
    const token = loginRes.data.token;
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    const projectsRes = await api.get('/projects');
    console.log('Projects Res:', projectsRes);
    console.log('projectsRes.data:', projectsRes.data);

    const usersRes = await api.get('/users');
    console.log('usersRes.data:', usersRes.data);
  } catch (err) {
    console.error('Error:', err.response ? err.response.data : err.message);
  }
}

test();
