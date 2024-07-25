<script setup lang="ts">
import { ref } from 'vue'

const user = ref('')
const email = ref('')
const password = ref('')
const response = ref('')
const submitted = ref(false)

const submit = async () => {
  const { message } = await (await fetch(`${import.meta.env.VITE_API_URL}/users/signup`, {
    method: 'POST',
    body: JSON.stringify({
      user: user.value,
      email: email.value,
      password: password.value
    })
  })).json()

  if (message) {
    response.value = message
  }
}
</script>
<template>
  <div class="container">
    <div class="row justify-content-md-center">
      <div class="col-md-4">
        <h1>Cadastro</h1>
        <form @submit.prevent="submit" v-if="!submitted">
          <div class="mb-3">
            <label for="user" class="form-label">Nome de usuário</label>
            <input v-model="user" type="text" class="form-control" id="user">
          </div>
          <div class="mb-3">
            <label for="exampleInputEmail1" class="form-label">E-mail</label>
            <input v-model="email" type="email" class="form-control" id="exampleInputEmail1" aria-describedby="emailHelp">
          </div>
          <div class="mb-3">
            <label for="exampleInputPassword1" class="form-label">Senha</label>
            <input v-model="password" type="password" class="form-control" id="exampleInputPassword1">
          </div>
          <button type="submit" class="btn btn-primary">Cadastrar</button>
        </form>
      </div>
    </div>
  </div>



</template>