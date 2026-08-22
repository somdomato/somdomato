// Package auth cuida de hashing de senha, emissão/validação de JWT de
// sessão e consulta de permissões por papel — porta de src/lib/password.ts,
// src/lib/session.ts e src/lib/permissions.ts.
package auth

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/somdomato/somdomato/api/models"
	"github.com/somdomato/somdomato/api/rbac"
	"golang.org/x/crypto/bcrypt"
)

const SessionTTL = 8 * time.Hour

var ErrInvalidCredentials = errors.New("credenciais inválidas")

// --- Senhas -----------------------------------------------------------

func HashPassword(plain string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(plain), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("gerando hash de senha: %w", err)
	}
	return string(hash), nil
}

func VerifyPassword(hash, plain string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(plain)) == nil
}

// --- JWT de sessão ------------------------------------------------------

type Claims struct {
	UserID int64  `json:"uid"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

func IssueToken(secret string, userID int64, role string) (string, error) {
	now := time.Now()
	claims := Claims{
		UserID: userID,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(SessionTTL)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func ParseToken(secret, tokenString string) (*Claims, error) {
	var claims Claims
	token, err := jwt.ParseWithClaims(tokenString, &claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("método de assinatura inesperado: %v", t.Header["alg"])
		}
		return []byte(secret), nil
	})
	if err != nil || !token.Valid {
		return nil, fmt.Errorf("token inválido: %w", err)
	}
	return &claims, nil
}

// --- Usuários -------------------------------------------------------------

type Store struct {
	pool *pgxpool.Pool
}

func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

func (s *Store) Authenticate(ctx context.Context, email, password string) (*models.User, error) {
	var u models.User
	err := s.pool.QueryRow(ctx, `
		SELECT id, name, email, password_hash, role, created_at FROM users WHERE email = $1`, email).
		Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.Role, &u.CreatedAt)
	if err == pgx.ErrNoRows {
		return nil, ErrInvalidCredentials
	}
	if err != nil {
		return nil, fmt.Errorf("buscando usuário: %w", err)
	}
	if !VerifyPassword(u.PasswordHash, password) {
		return nil, ErrInvalidCredentials
	}
	return &u, nil
}

func (s *Store) GetUserByID(ctx context.Context, id int64) (*models.User, error) {
	var u models.User
	err := s.pool.QueryRow(ctx, `
		SELECT id, name, email, password_hash, role, created_at FROM users WHERE id = $1`, id).
		Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.Role, &u.CreatedAt)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("buscando usuário por id: %w", err)
	}
	return &u, nil
}

// GetPermissionsForRole lê `role_permissions` (seed default aplicado na
// migration; customizável depois pelo admin via `users:manage`).
func (s *Store) GetPermissionsForRole(ctx context.Context, role string) ([]string, error) {
	rows, err := s.pool.Query(ctx, `SELECT permission FROM role_permissions WHERE role = $1`, role)
	if err != nil {
		return nil, fmt.Errorf("consultando permissões: %w", err)
	}
	defer rows.Close()

	var perms []string
	for rows.Next() {
		var p string
		if err := rows.Scan(&p); err != nil {
			return nil, err
		}
		perms = append(perms, p)
	}
	return perms, rows.Err()
}

func HasPermission(perms []string, want rbac.Permission) bool {
	for _, p := range perms {
		if p == string(want) {
			return true
		}
	}
	return false
}
