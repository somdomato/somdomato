package deezerdl

import (
	"crypto/cipher"
	"crypto/md5"
	"encoding/hex"

	"golang.org/x/crypto/blowfish"
)

// blowfishIV e blowfishSecretKey são constantes do próprio Deezer (as
// mesmas para toda faixa e todo usuário, publicamente conhecidas) — não são
// segredos deste projeto. Só a chave derivada por track em blowfishKey
// varia.
var (
	blowfishIV        = []byte{0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07}
	blowfishSecretKey = []byte("g4el58wc0zvf9na1")
)

// blowfishKey deriva a chave de decriptação por faixa: MD5 do ID em hex,
// dobrado nas duas metades sobre o segredo (XOR do byte i com os dígitos
// hex i e i+16).
func blowfishKey(trackID string) []byte {
	hash := md5.Sum([]byte(trackID))
	hashHex := hex.EncodeToString(hash[:])

	key := make([]byte, len(blowfishSecretKey))
	copy(key, blowfishSecretKey)
	for i := range len(hash) {
		key[i] = key[i] ^ hashHex[i] ^ hashHex[i+16]
	}
	return key
}

// decryptBlowfishChunk decripta um único chunk do stream (CBC, IV fixo).
// Não é uma operação de arquivo inteiro: o Deezer só encripta 1 a cada 3
// chunks (o "stripe" do cipher BF_CBC_STRIPE) — ver streamToFile.
func decryptBlowfishChunk(data, key []byte) ([]byte, error) {
	block, err := blowfish.NewCipher(key)
	if err != nil {
		return nil, err
	}
	decrypted := make([]byte, len(data))
	cipher.NewCBCDecrypter(block, blowfishIV).CryptBlocks(decrypted, data)
	return decrypted, nil
}
