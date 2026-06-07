function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body || {});

    if (!result.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: result.errors,
      });
    }

    req.body = result.data;
    return next();
  };
}

function stringField({
  label,
  required = true,
  min = 0,
  max = Infinity,
  trim = true,
  lowercase = false,
} = {}) {
  return (value, field) => {
    const fieldLabel = label || field;

    if (value === undefined || value === null || value === "") {
      if (required) {
        return { error: `${fieldLabel} is required` };
      }
      return { value: undefined };
    }

    if (typeof value !== "string") {
      return { error: `${fieldLabel} must be a string` };
    }

    let normalized = trim ? value.trim() : value;

    if (normalized.length < min) {
      return { error: `${fieldLabel} must be at least ${min} characters` };
    }

    if (normalized.length > max) {
      return { error: `${fieldLabel} must be at most ${max} characters` };
    }

    if (lowercase) {
      normalized = normalized.toLowerCase();
    }

    return { value: normalized };
  };
}

function emailField({ label = "Email" } = {}) {
  const normalizeString = stringField({
    label,
    required: true,
    min: 3,
    max: 254,
    lowercase: true,
  });

  return (value, field) => {
    const result = normalizeString(value, field);

    if (result.error) {
      return result;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.value)) {
      return { error: `${label} is invalid` };
    }

    return result;
  };
}

function objectSchema(shape) {
  return {
    safeParse(input) {
      if (!isPlainObject(input)) {
        return {
          success: false,
          errors: [{ field: "body", message: "Request body must be an object" }],
        };
      }

      const data = {};
      const errors = [];

      Object.entries(shape).forEach(([field, parser]) => {
        const result = parser(input[field], field);

        if (result.error) {
          errors.push({ field, message: result.error });
          return;
        }

        if (result.value !== undefined) {
          data[field] = result.value;
        }
      });

      if (errors.length) {
        return {
          success: false,
          errors,
        };
      }

      return {
        success: true,
        data,
      };
    },
  };
}

module.exports = {
  emailField,
  objectSchema,
  stringField,
  validate,
};
