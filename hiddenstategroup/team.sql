-- Hidden State — the whole team, rebuilt.
--
-- Run in Terminal, in your project folder:
--   npx wrangler d1 execute hiddenstate --remote --file=./team.sql
--
-- Replaces every existing account and signs everyone out.

DELETE FROM sessions;
DELETE FROM team;

INSERT INTO team (username, role, display_name, password_hash, salt, active, created_at, created_by) VALUES ('hiddenstateboss_stephannojunior', 'BOSS', 'Stephanno Jr.', '2982be85daf766cc6f417fdb73c30f55c0a70f0a99f15eda732ddfb8ed6e8616', '54bd7098327b36f0819572517d43ee5a', 1, datetime('now'), 'setup');
INSERT INTO team (username, role, display_name, password_hash, salt, active, created_at, created_by) VALUES ('admin1', 'OWNER', 'Admin 1', '35c787952e4262069f75bc71208925b354dbe95d11f7851f57b80bfb07dbb2f2', 'df7c354383d5b171b3e6f9ed27181313', 1, datetime('now'), 'setup');
INSERT INTO team (username, role, display_name, password_hash, salt, active, created_at, created_by) VALUES ('admin2', 'OWNER', 'Admin 2', '17a9062f427fc3f02218ba08fa3dcd13f8b1d43f1931d190c165cf1f653fe845', '58f0894ad0d8b9afad1c3057ae08197f', 1, datetime('now'), 'setup');
INSERT INTO team (username, role, display_name, password_hash, salt, active, created_at, created_by) VALUES ('admin3', 'OWNER', 'Admin 3', '077dd88c5032f6aaa2f106b8a67730fef8c133218bf41ffa9dcb1590e0b67dfb', '05ed26152ac4009f0dcffb91c56c2ba3', 1, datetime('now'), 'setup');
INSERT INTO team (username, role, display_name, password_hash, salt, active, created_at, created_by) VALUES ('admin4', 'OWNER', 'Admin 4', '4b69e0e1d4f928333665f216a4c095a86946151daa0d9b8bf5e353381c397d00', '6780ba9da751c5421d34992cd6b2960e', 1, datetime('now'), 'setup');
INSERT INTO team (username, role, display_name, password_hash, salt, active, created_at, created_by) VALUES ('admin5', 'OWNER', 'Admin 5', '1dd391de18dc6843dd44171912e2eeecd1bfa362fe9175051fd300108a1ccf7d', '8ba100f0679638a0fde36c20f04369eb', 1, datetime('now'), 'setup');
INSERT INTO team (username, role, display_name, password_hash, salt, active, created_at, created_by) VALUES ('staff1', 'STAFF', 'Staff 1', 'e8f507fee49097c74580d02a92b357d55bfff3bb35dc72004b7e62275f19e7b3', 'a3607ac92f6bef32a31e1cb4334371f8', 1, datetime('now'), 'setup');
INSERT INTO team (username, role, display_name, password_hash, salt, active, created_at, created_by) VALUES ('staff2', 'STAFF', 'Staff 2', '777c2ff6c268911870d7fdb2fda651367f2bfa7882e990f94b5a972e0bf5f508', '93223682ad2548eb13c3a9d45bf48664', 1, datetime('now'), 'setup');
INSERT INTO team (username, role, display_name, password_hash, salt, active, created_at, created_by) VALUES ('staff3', 'STAFF', 'Staff 3', 'd43eedb98cf3e5be56133d890a60ec5948ed5fa6c84be694c7788af7b4f5036e', 'df4afb9d8a9210f2900f709773d47ab4', 1, datetime('now'), 'setup');
INSERT INTO team (username, role, display_name, password_hash, salt, active, created_at, created_by) VALUES ('staff4', 'STAFF', 'Staff 4', '09e4fb0cbc63bb399a3ee3966ef60a3a7303685b8a327291a94adca968f95b25', '3ed62e13db47fa036b030050182ceba5', 1, datetime('now'), 'setup');
INSERT INTO team (username, role, display_name, password_hash, salt, active, created_at, created_by) VALUES ('staff5', 'STAFF', 'Staff 5', 'ce88273fe38fdc5640f232a4329fd844cbbe2f84ae9a940ceccfc824a54cf89f', 'ee2e89936aec7638af6d71aa8cabbcbc', 1, datetime('now'), 'setup');
INSERT INTO team (username, role, display_name, password_hash, salt, active, created_at, created_by) VALUES ('staff6', 'STAFF', 'Staff 6', 'da20e4dff53a3f7688485360cec95f53a0dd57db25e74fe1ea5f82f55e183400', '95c8c22bba2e80bbb229a4b3384859a6', 1, datetime('now'), 'setup');
INSERT INTO team (username, role, display_name, password_hash, salt, active, created_at, created_by) VALUES ('staff7', 'STAFF', 'Staff 7', 'ff8727effbd878be5c1ba259e06fc2bd89c265863b41c8ea9d6e3d4820493aa7', '76b31fa8f5a60bb99173ba62acda995c', 1, datetime('now'), 'setup');
INSERT INTO team (username, role, display_name, password_hash, salt, active, created_at, created_by) VALUES ('staff8', 'STAFF', 'Staff 8', '5b3b9516efed065e30aab9962b5afb91117829ae55e32dd5c42534f6a6586e8e', 'c2504de1e459d78837cddd6d8edad6a8', 1, datetime('now'), 'setup');
INSERT INTO team (username, role, display_name, password_hash, salt, active, created_at, created_by) VALUES ('staff9', 'STAFF', 'Staff 9', 'b4d75a423ea7f2b9ce7f3b7e87e141fccdd1b9cdb1f7dc6c9947963da5aafade', '06da9e8bcb57b65f003c930a043afe96', 1, datetime('now'), 'setup');
INSERT INTO team (username, role, display_name, password_hash, salt, active, created_at, created_by) VALUES ('staff10', 'STAFF', 'Staff 10', 'cc4ad3a792dacb2857da30d61098cef7923982b7c4fe4496fb1e9308245fad57', 'ad1f2647f092b4de97d52333eda32808', 1, datetime('now'), 'setup');
