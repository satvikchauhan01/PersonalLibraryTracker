// Validates req.body against a Zod schema. On success, req.body is replaced
// with the parsed (trimmed/defaulted) result; on failure, responds 400 with
// a field-specific message instead of letting a bad request reach the DB.
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const message = result.error.issues.map((issue) => issue.message).join(', ');
    return res.status(400).json({ message });
  }

  req.body = result.data;
  next();
};

export default validate;
