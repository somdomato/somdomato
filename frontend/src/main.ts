import '@/styles/scss/main.scss'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from '@/app.vue'
import router from '@/router'
import VuePlyr from '@skjnldsv/vue-plyr'
import '@skjnldsv/vue-plyr/dist/vue-plyr.css'
import { controls } from '@/data/controls'
import { tooltip, popover } from '@/directives/bootstrap'


const app = createApp(App)

app
 .directive('tooltip', tooltip)
 .directive('popover', popover)

app.use(VuePlyr, { 
  plyr: { controls } 
})

app.use(createPinia())
app.use(router)

app.mount('#app')
