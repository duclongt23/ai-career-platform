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
  createAdminSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
};
