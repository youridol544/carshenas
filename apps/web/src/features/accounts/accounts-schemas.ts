import * as z from 'zod';

// The shape of what the accounts' forms and the availability check send (every argument is hostile: the Next.js
// data-security guide). A field that is missing or a file becomes an empty string, and anything longer than a
// person could mean is cut off before any work is done on it: the username and password rules themselves live in
// @carshenas/accounts, which both the forms and pnpm account:superadmin use.

const MAX_USERNAME_TYPED = 200;
const MAX_PASSWORD_TYPED = 1_000;
const MAX_NEXT = 2_048;

function formText(max: number) {
  return z.preprocess((value) => (typeof value === 'string' ? value : ''), z.string().max(max));
}

export const accountFormSchema = z.object({
  username: formText(MAX_USERNAME_TYPED),
  password: formText(MAX_PASSWORD_TYPED),
  next: formText(MAX_NEXT),
});

export type AccountForm = z.infer<typeof accountFormSchema>;

/** Reads the form's fields; a value too long to be meant comes back as undefined. */
export function readAccountForm(formData: FormData): AccountForm | undefined {
  const parsed = accountFormSchema.safeParse({
    username: formData.get('username'),
    password: formData.get('password'),
    next: formData.get('next'),
  });
  return parsed.success ? parsed.data : undefined;
}

export const usernameCheckSchema = z.object({ username: z.string().max(MAX_USERNAME_TYPED) });
