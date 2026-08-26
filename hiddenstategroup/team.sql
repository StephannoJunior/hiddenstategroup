-- Hidden State — the whole team, rebuilt.
--
-- Run in Terminal, in your project folder:
--   npx wrangler d1 execute hiddenstate --remote --file=./team.sql
--
-- Replaces every existing account and signs everyone out.

DELETE FROM sessions;
DELETE FROM team;

INSERT INTO team (username, role, display_name, password_hash, salt, active, created_at, created_by) VALUES ('hiddenstateboss_stephannojunior', 'BOSS', 'Stephanno Jr.', '7c3982ff2abc3a79efe49c4134e1b07d8176cc8142344d8c9df1e5fd4366c32c', '54bd7098327b36f0819572517d43ee5a', 1, datetime('now'), 'setup');
INSERT INTO team (username, role, display_name, password_hash, salt, active, created_at, created_by) VALUES ('admin1', 'OWNER', 'Admin 1', 'db5fe28d125ec87613f5fe0cf7f62cc1fb804bcdf70f6affca5700f7320cf349', 'df7c354383d5b171b3e6f9ed27181313', 1, datetime('now'), 'setup');
INSERT INTO team (username, role, display_name, password_hash, salt, active, created_at, created_by) VALUES ('admin2', 'OWNER', 'Admin 2', '48ddc03d60df9ca495da1f8f27ca0edb695793aded9f3adb84ef83da0cc42a45', '58f0894ad0d8b9afad1c3057ae08197f', 1, datetime('now'), 'setup');
INSERT INTO team (username, role, display_name, password_hash, salt, active, created_at, created_by) VALUES ('admin3', 'OWNER', 'Admin 3', 'd9199be97f6e1f70838279ee436a31b29eb24ccc9a550f7dd28397866e042e80', '05ed26152ac4009f0dcffb91c56c2ba3', 1, datetime('now'), 'setup');
INSERT INTO team (username, role, display_name, password_hash, salt, active, created_at, created_by) VALUES ('admin4', 'OWNER', 'Admin 4', '58d697e7eae84c8d10db117ff5c5737e939ebba8d8fc8bf49c9215ec02427009', '6780ba9da751c5421d34992cd6b2960e', 1, datetime('now'), 'setup');
INSERT INTO team (username, role, display_name, password_hash, salt, active, created_at, created_by) VALUES ('admin5', 'OWNER', 'Admin 5', '1bb3e571fa5e3439ec92ea62d46114e666bc2085b93201f69a044c6867a754f4', '8ba100f0679638a0fde36c20f04369eb', 1, datetime('now'), 'setup');
INSERT INTO team (username, role, display_name, password_hash, salt, active, created_at, created_by) VALUES ('staff1', 'STAFF', 'Staff 1', 'c57670b597e5b698962f65fbd710676a6cbbbdec7be9f5f2da44aedfaaa31d8f', 'a3607ac92f6bef32a31e1cb4334371f8', 1, datetime('now'), 'setup');
INSERT INTO team (username, role, display_name, password_hash, salt, active, created_at, created_by) VALUES ('staff2', 'STAFF', 'Staff 2', '4307951ca05adecb2df9bc2e8f495442ad8c7bc5160976310b06b7a79669255a', '93223682ad2548eb13c3a9d45bf48664', 1, datetime('now'), 'setup');
INSERT INTO team (username, role, display_name, password_hash, salt, active, created_at, created_by) VALUES ('staff3', 'STAFF', 'Staff 3', '9b4859d5a778f48016ec795d106dde38b038022106f347e5dc023de3cd9f937a', 'df4afb9d8a9210f2900f709773d47ab4', 1, datetime('now'), 'setup');
INSERT INTO team (username, role, display_name, password_hash, salt, active, created_at, created_by) VALUES ('staff4', 'STAFF', 'Staff 4', 'c3c9b122e17e68b4fb41e376b636b65ea0693f7b56c1c283db6002d02e1632e2', '3ed62e13db47fa036b030050182ceba5', 1, datetime('now'), 'setup');
INSERT INTO team (username, role, display_name, password_hash, salt, active, created_at, created_by) VALUES ('staff5', 'STAFF', 'Staff 5', '6e9e86a899b4f92f0b188e891ec641ff9b6a02046cf396a2601d01faafc78b26', 'ee2e89936aec7638af6d71aa8cabbcbc', 1, datetime('now'), 'setup');
INSERT INTO team (username, role, display_name, password_hash, salt, active, created_at, created_by) VALUES ('staff6', 'STAFF', 'Staff 6', '5a3ed9d74a69c92a715bdae1a67d39f72d3ffa044f8405e6af7e5790e4c83498', '95c8c22bba2e80bbb229a4b3384859a6', 1, datetime('now'), 'setup');
INSERT INTO team (username, role, display_name, password_hash, salt, active, created_at, created_by) VALUES ('staff7', 'STAFF', 'Staff 7', 'eae4e090f517d7ea45cc3bb420470e0c341c42cb821d56a53739429e8715c7f7', '76b31fa8f5a60bb99173ba62acda995c', 1, datetime('now'), 'setup');
INSERT INTO team (username, role, display_name, password_hash, salt, active, created_at, created_by) VALUES ('staff8', 'STAFF', 'Staff 8', 'a9594fe6c40a4b6f8add8f97469abca86f31176d38930a7a6942c7f2dde72649', 'c2504de1e459d78837cddd6d8edad6a8', 1, datetime('now'), 'setup');
INSERT INTO team (username, role, display_name, password_hash, salt, active, created_at, created_by) VALUES ('staff9', 'STAFF', 'Staff 9', '69b9f3629167330766983286d0daa9211ce70270a4cec793d219cb9f7353242b', '06da9e8bcb57b65f003c930a043afe96', 1, datetime('now'), 'setup');
INSERT INTO team (username, role, display_name, password_hash, salt, active, created_at, created_by) VALUES ('staff10', 'STAFF', 'Staff 10', '6d752101f373c6361b4c786b35f0bdb0e734d9c1afe7385432821af2ac7d4de1', 'ad1f2647f092b4de97d52333eda32808', 1, datetime('now'), 'setup');
