export const routes = [
  { path: '/', name: 'Home', component: () => import('@/views/home.vue') },
  { path: '/upload', name: 'Upload', component: () => import('@/views/upload.vue') }
]