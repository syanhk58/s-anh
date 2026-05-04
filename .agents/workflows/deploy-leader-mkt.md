---
description: Deploy LEADER MKT TALPHA changes to GitHub and Vercel
---

# Deploy LEADER MKT TALPHA

Mỗi khi thay đổi files trong `/Users/macbook/Desktop/LEADER MKT TALPHA/`, thực hiện:

## 1. Sync files sang tmp-leader repo
// turbo
```bash
rsync -av --exclude='node_modules' --exclude='.next' --exclude='.git' "/Users/macbook/Desktop/LEADER MKT TALPHA/" /Users/macbook/Desktop/s-anh/tmp-leader/ --delete
```

## 2. Commit và Push lên GitHub
```bash
cd /Users/macbook/Desktop/s-anh/tmp-leader && git add -A && git commit -m "<mô tả thay đổi>" && git push origin main
```
- Repo: https://github.com/syanh12092024-maker/leader-mkt-talpha-1
- Branch: main

## 3. Vercel tự động deploy
- URL: https://talpha-dashboard.vercel.app/talpha
- Vercel đã kết nối repo GitHub → push main sẽ tự deploy

## Notes
- Workspace chính của user: `/Users/macbook/Desktop/LEADER MKT TALPHA/`
- Clone repo dùng để push: `/Users/macbook/Desktop/s-anh/tmp-leader/`
- Khi edit files, edit trực tiếp ở LEADER MKT TALPHA, sau đó sync + push
