<template>
  <footer class="pt-4 my-md-5 pt-md-5 border-top bg-body-tertiary">
    <div class="container">
      <div class="row">
        <div class="col-12 col-md">
          <img class="mb-2" src="/images/logotipo.svg" alt="" width="24" height="24">
          <small class="d-block text-body-secondary">
            &copy; 2012–{{ new Date().getFullYear() }} Rádio Som do Mato<br />
          </small>
          <small class="d-block mb-3 text-body-secondary fst-italic">Por amor à música sertaneja.</small>
        </div>
        <div class="col-6 col-md">
          <h5>Redes</h5>
          <ul class="list-unstyled text-small">
            <li class="mb-1"><a class="link-secondary text-decoration-none" href="https://facebook.somdomato.com">Facebook</a></li>
            <li class="mb-1"><a class="link-secondary text-decoration-none" href="https://x.somdomato.com">X</a></li>
          </ul>
        </div>
        <div class="col-6 col-md">
          <h5>Ajuda</h5>
          <ul class="list-unstyled text-small">
            <li class="mb-1"><router-link class="link-secondary text-decoration-none" to="/ajuda/pesquisa">Pesquisa</router-link></li>
            <li class="mb-1"><router-link class="link-secondary text-decoration-none" to="/">Termos</router-link></li>
            <li class="mb-1"><router-link class="link-secondary text-decoration-none" to="/">Privacidade</router-link></li>
          </ul>
        </div>
        <div class="col-6 col-md">
          <h5>Sobre</h5>
          <ul class="list-unstyled text-small">
            <li class="mb-1"><router-link class="link-secondary text-decoration-none" to="/sobre/quem">Quem</router-link></li>
            <li class="mb-1"><router-link class="link-secondary text-decoration-none" to="/sobre/onde">Onde</router-link></li>
            <li class="mb-1"><router-link class="link-secondary text-decoration-none" to="/sobre/como">Como</router-link></li>
          </ul>
        </div>
      </div>
    </div>
  </footer>
</template>