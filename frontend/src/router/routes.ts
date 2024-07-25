export const routes = [
  { path: '/', name: 'Home', component: () => import('@/views/home.vue') },
  { path: '/upload', name: 'Upload', component: () => import('@/views/upload.vue') },
  { path: '/entrar', name: 'Signin', component: () => import('@/views/entrar.vue') },
  { path: '/cadastro', name: 'Signup', component: () => import('@/views/cadastro.vue') },
  { path: '/:pathMatch(.*)*', name: 'NotFound', component: () => import('@/views/erro.vue') }
]