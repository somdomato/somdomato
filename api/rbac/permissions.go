package rbac

// Permission — porta de src/lib/permissions.ts. Os valores atribuídos por
// papel vivem na tabela `role_permissions` (seed em migration 0001); esta
// lista é usada para validar entradas e rotular a UI do admin.
type Permission string

const (
	PermSongsEditTags  Permission = "songs:edit_tags"
	PermSongsEditFile  Permission = "songs:edit_file"
	PermSongsDelete    Permission = "songs:delete"
	PermRequestsManage Permission = "requests:manage"
	PermJinglesManage  Permission = "jingles:manage"
	PermLogsView       Permission = "logs:view"
	PermUsersManage    Permission = "users:manage"
)

var PermissionLabels = map[Permission]string{
	PermSongsEditTags:  "Editar Tags",
	PermSongsEditFile:  "Editar Arquivo",
	PermSongsDelete:    "Apagar Música",
	PermRequestsManage: "Gerenciar Pedidos",
	PermJinglesManage:  "Gerenciar Vinhetas",
	PermLogsView:       "Ver Logs",
	PermUsersManage:    "Gerenciar Usuários",
}

type Role string

const (
	RoleUser       Role = "user"
	RoleLocutor    Role = "locutor"
	RoleModerator  Role = "moderator"
	RoleAdmin      Role = "admin"
	RoleSuperAdmin Role = "super_admin"
)

var AllRoles = []Role{RoleUser, RoleLocutor, RoleModerator, RoleAdmin, RoleSuperAdmin}

var AdminRoles = map[Role]bool{
	RoleLocutor: true, RoleModerator: true, RoleAdmin: true, RoleSuperAdmin: true,
}

var RoleLabels = map[Role]string{
	RoleUser:       "Ouvinte",
	RoleLocutor:    "Locutor",
	RoleModerator:  "Moderador",
	RoleAdmin:      "Admin",
	RoleSuperAdmin: "Super Admin",
}

func IsValidRole(r string) bool {
	for _, v := range AllRoles {
		if string(v) == r {
			return true
		}
	}
	return false
}

func IsAdminRole(r string) bool {
	return AdminRoles[Role(r)]
}
