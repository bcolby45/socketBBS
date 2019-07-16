# How to start using socketBBS (These instructions are only for Linux)

1. Install MongoDB and NodeJS. If you don't know how to do this, there are plenty of easy to follow guides for every distro. You can find these guides using your search engine of choice.

2. Open your terminal, type `mongo` and press enter. Then type `use admin` and press enter.

3. Now, you must create a user. You can do so with the following command:

```JavaScript
 db.createUser({
    user: "username",
    pwd: "password",
    roles: [ { role: "userAdminAnyDatabase", db: "admin" } ]
 })
```

4. Type `exit` and press enter to exit the MongoDB app.

5. Navigate to the folder where you saved socketBBS, then type npm install and press enter.

6.  Open up app.js in a text editor of your choice and go to line 33. Change the MongoDB connection URL to suit your configuration. The format of the URL is `$USERNAME:$PASSWORD@$HOST:$PORT/$DATABASE`.

7. Type `npm start` and press enter. You are now running socketBBS.

### If you want to run socketBBS in the background, I suggest using tmux.

## Warning: If you are using cloudflare, socketBBS will not work properly unless you set cloudflare to true. This is on line 29 in `app.js`.
