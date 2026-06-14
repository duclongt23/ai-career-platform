const {
  emailField,
  objectSchema,
  stringField,
} = require("../middleware/validate.middleware");

const registerSchema = objectSchema({
  name: stringField({ label: "Name", min: 2, max: 80 }),
  email: emailField(),
  password: stringField({ label: "Password", min: 6, max: 128 }),
});

const loginSchema = objectSchema({
  email: emailField(),
  password: stringField({ label: "Password", min: 1, max: 128 }),
});

const refreshSchema = objectSchema({
  refreshToken: stringField({ label: "Refresh token", min: 64, max: 256 }),
});

const forgotPasswordSchema = objectSchema({
  email: emailField(),
});

const resetPasswordSchema = objectSchema({
  token: stringField({ label: "Reset token", min: 64, max: 128 }),
  password: stringField({ label: "Password", min: 6, max: 128 }),
});

const changePasswordSchema = objectSchema({
  currentPassword: stringField({ label: "Current password", min: 1, max: 128 }),
  newPassword: stringField({ label: "New password", min: 6, max: 128 }),
});

const createAdminSchema = objectSchema({
  name: stringField({ label: "Name", min: 2, max: 80 }),
  email: emailField(),
  password: stringField({ label: "Password", min: 10, max: 128 }),
  setupSecret: stringField({
    label: "Setup secret",
    required: false,
    min: 16,
    max: 256,
  }),
});

module.exports = {
  changePasswordSchema,
  createAdminSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
};
