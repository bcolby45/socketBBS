# How to start using socketBBS (These instructions are only for Linux)

1. Install MongoDB and NodeJS. If you don't know how to do this, there are plenty of easy to follow guides for every distro. You can find these guides using your search engine of choice.

2. Open your terminal, type mongo and press enter. Then type use admin and press enter.

3. Now, you must create a user. You can do so with the following command:

```
 db.createUser(
  {
    user: "username",
    pwd: "password",
    roles: [ { role: "userAdminAnyDatabase", db: "admin" } ]
}
)
```

4. Navigate to the folder where you saved socketBBS, then type npm install and press enter.

5. Open up app.js in a text editor of your choice and go to line 26. Input the username and password for the account you created earlier.

6. Type npm start and press enter. You are now running socketBBS.


If you want to run socketBBS in the background, I suggest using tmux.


## Warning: If you are using cloudflare, socketBBS will not work properly unless you set cloudflare to true. This is on line 17 in app.js.
