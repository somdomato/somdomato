import '@/styles/scss/main.scss'
import 'notivue/notification.css' // Only needed if using built-in <Notification />
import 'notivue/animations.css' // Only needed if using default animations
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createNotivue } from 'notivue'
import App from '@/app.vue'
import router from '@/router'
import VuePlyr from '@skjnldsv/vue-plyr'
import '@skjnldsv/vue-plyr/dist/vue-plyr.css'
import { controls } from '@/data/controls'
import { tooltip, popover } from '@/directives/bootstrap'

const notivue = createNotivue({
  position: 'top-right',
  limit: 4,
  enqueue: true,
  avoidDuplicates: true,
  notifications: {
    global: {
      duration: 10000
    }
  }
})

const app = createApp(App)

app.use(notivue)
app
 .directive('tooltip', tooltip)
 .directive('popover', popover)

app.use(VuePlyr, { 
  plyr: { controls } 
})


app.use(createPinia())
app.use(router)

app.mount('#app')














