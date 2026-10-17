// Git invokes this helper; credentials travel via process memory, never arguments/files.
const prompt = process.argv[2] || '';
if (/Username.*https:\/\/github\.com/i.test(prompt)) process.stdout.write('x-access-token\n');
else if (/Password.*https:\/\/(?:x-access-token@)?github\.com/i.test(prompt)) process.stdout.write((process.env.STUDIO_GITHUB_TOKEN || '') + '\n');
else process.exitCode = 1;
