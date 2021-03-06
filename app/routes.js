const express = require('express');
const request = require('request');
const api = require('./api.js');
const auth = require('http-auth');
const dateFns = require('date-fns');
const config = require('./config/config.js');
const {
    getGlamByName,
    getAllGlams,
    getReportData,
    dbDateFormat
} = require('./lib/db.js');

function isValidGlam(glam) {
    return glam !== undefined && glam['status'] === 'running' && glam['lastrun'] !== null;
}

module.exports = function (app) {

    app.use('/views/templates/:file', function (req, res) {
        if (req.params.file.endsWith('hbs')) {
            res.renderWithLocal(`/pages/views/templates/${req.params.file}`);
        } else {
            res.sendFile(__dirname + `/pages/views/templates/${req.params.file}`);
        }
    })

    app.use('/', express.static(__dirname + '/pages'));

    app.get('/', async function (req, res) {
        const glams = await getAllGlams();
        res.renderWithLocal('/pages/index.hbs', { glams });
    });

    app.get('/about', async function (req, res) {
        const glams = await getAllGlams();
        res.renderWithLocal('/pages/about.hbs', { glams });
    });

    app.get('/join', async function (req, res) {
        const glams = await getAllGlams();
        res.renderWithLocal('/pages/join.hbs', { glams });
    });

    app.get('/contact', async function (req, res) {
        const glams = await getAllGlams();
        res.renderWithLocal('/pages/contact.hbs', { glams });
    });

    app.get('/cassandra-app', (req, res) => { // health check
        res.send("ok");
    })

    app.use(async function (req, res, next) {

        function getId(path) {
            let exploded = path.split('/');
            if (path.startsWith('/api/')) {
                return exploded[2];
            } else {
                return exploded[1];
            }
        }

        function authenticateAdmin(auth_config) {
            let auth_basic = auth.basic({
                realm: auth_config['realm']
            }, function (username, password, callback) {
                callback(username === auth_config['username'] && password === auth_config['password']);
            });
            const callCheck = auth_basic.check(() => {
                next();
            });
            callCheck(req, res);
        }

        function createGlamAuth(auth_config) {
            let auth_basic = auth.basic({
                realm: auth_config['realm']
            }, function (username, password, callback) {
                for (let i = 0; i < auth_config.users.length; i++) {
                    if (username === auth_config.users[i]['username'] && password === auth_config.users[i]['password']) {
                        callback(true);
                        return;
                    }
                }
                callback(false);
            });
            (auth.connect(auth_basic))(req, res, next);
        }

        let id = getId(req.path);
        if (!id) {
            next();
            return;
        }
        if (id === 'user') {
            createGlamAuth(config.glamUser);
        } else if (id === 'admin') {
            authenticateAdmin(config.admin);
        } else {
            try {
                let glam = await getGlamByName(id);
                if (!glam) {
                    next();
                } else if (glam.hasOwnProperty('http-auth') === false) {
                    next();
                } else {
                    authenticateAdmin(glam['http-auth']);
                }
            } catch (err) {
                next(err);
            }
        }
    });

    // ADMIN PANEL
    app.get('/admin/panel', async function (req, res) {
        res.renderWithLocal(`/pages/views/admin-panel.hbs`);
    });

    app.get('/admin/new-glam', async function (req, res) {
        res.renderWithLocal(`/pages/views/new-glam.hbs`);
    });

    app.get('/admin/edit-glam/:id', async function (req, res) {
        let glam = await getGlamByName(req.params.id);
        if (glam !== undefined) {
            res.renderWithLocal(`/pages/views/edit-glam.hbs`);
        } else {
            res.sendStatus(400);
        }
    });

    // VIEWS
    app.get('/:id', async function (req, res) {
        const glams = await getAllGlams();
        const glam = glams.find(glam => glam.name === req.params.id);
        if (isValidGlam(glam)) {
            let forDate;
            if (req.query.date) {
                try {
                    forDate = dateFns.parse(req.query.date, dbDateFormat, new Date());
                } catch (e) { }
            }
            const data = await getReportData(glam, forDate);
            res.renderWithLocal('/pages/views/index.hbs', { glams, glam, data });
        } else {
            res.sendStatus(400);
        }
    });

    app.get('/:id/file/:file', async function (req, res) {
        let glam = await getGlamByName(req.params.id);
        if (isValidGlam(glam)) {
            res.renderWithLocal('/pages/views/file-page/index.hbs');
        } else {
            res.sendStatus(400);
        }
    });

    app.get('/:id/search/:query', async function (req, res) {
        let glam = await getGlamByName(req.params.id);
        if (isValidGlam(glam)) {
            res.renderWithLocal('/pages/views/search-page/index.hbs');
        } else {
            res.sendStatus(400);
        }
    });

    app.get('/:id/category-network/:name?', async function (req, res) {
        let glam = await getGlamByName(req.params.id);
        if (isValidGlam(glam)) {
            res.renderWithLocal('/pages/views/category-network/index.hbs');
        } else {
            res.sendStatus(400);
        }
    });

    app.get('/:id/category-network/:name/unused', async function (req, res) {
        let glam = await getGlamByName(req.params.id);
        if (isValidGlam(glam)) {
            res.renderWithLocal(`/pages/views/unused-files-page/index.hbs`);
        } else {
            res.sendStatus(400);
        }
    });

    app.get('/:id/recommender/:name?', async function (req, res) {
        let glam = await getGlamByName(req.params.id);
        if (isValidGlam(glam)) {
            res.renderWithLocal('/pages/views/recommender-page/index.hbs');
        } else {
            res.sendStatus(400);
        }
    });

    app.get('/:id/user-contributions/:name?', async function (req, res) {
        let glam = await getGlamByName(req.params.id);
        if (isValidGlam(glam)) {
            res.renderWithLocal('/pages/views/user-contributions/index.hbs');
        } else {
            res.sendStatus(400);
        }
    });

    app.get('/:id/usage/:name?', async function (req, res) {
        let glam = await getGlamByName(req.params.id);
        if (isValidGlam(glam)) {
            res.renderWithLocal('/pages/views/usage/index.hbs');
        } else {
            res.sendStatus(400);
        }
    });

    app.get('/:id/page-views/:name?', async function (req, res) {
        let glam = await getGlamByName(req.params.id);
        if (isValidGlam(glam)) {
            res.renderWithLocal('/pages/views/page-views/index.hbs');
        } else {
            res.sendStatus(400);
        }
    });

    // API
    app.get('/api/admin/auth', async function (req, res) {
        res.sendStatus(200);
    });

    app.get('/api/user/auth', async function (req, res) {
        res.sendStatus(200);
    });

    app.get('/api/glams', async function (req, res) {
        try {
            const glams = await getAllGlams();
            api.glams(req, res, glams);
        } catch (err) {
            console.error(err);
            res.sendStatus(500);
        }
    });

    app.get('/api/admin/glams', async function (request, response) {
        api.glams(request, response, await getAllGlams(), true);
    });

    app.post('/api/admin/glams', async function (req, res) {
        api.createGlam(req, res, config);
    });

    app.get('/api/admin/glams/:id', async function (req, res) {
        let glam = await getGlamByName(req.params.id);
        if (glam !== undefined) {
            api.getAdminGlam(req, res, glam);
        } else {
            res.sendStatus(404);
        }
    });

    app.put('/api/admin/glams/:id', async function (req, res) {
        let glam = await getGlamByName(req.params.id);
        if (glam !== undefined) {
            api.updateGlam(req, res, config);
        } else {
            res.sendStatus(404);
        }
    });

    app.get('/api/glams/:id/annotations', async function (req, res, next) {
        let glam = await getGlamByName(req.params.id);
        if (glam !== undefined) {
            api.getAnnotations(req, res, next, glam);
        } else {
            res.sendStatus(404);
        }
    });

    app.get('/api/admin/glams/:id/annotations/:date', async function (req, res, next) {
        let glam = await getGlamByName(req.params.id);
        if (glam !== undefined) {
            api.getAnnotation(req, res, next, glam);
        } else {
            res.sendStatus(404);
        }
    });

    app.put('/api/admin/glams/:id/annotations/:date', async function (req, res, next) {
        let glam = await getGlamByName(req.params.id);
        if (glam !== undefined) {
            api.modifyAnnotation(req, res, next, glam);
        } else {
            res.sendStatus(404);
        }
    });

    app.post('/api/admin/glams/:id/annotations/:date', async function (req, res, next) {
        let glam = await getGlamByName(req.params.id);
        if (glam !== undefined) {
            api.createAnnotation(req, res, next, glam);
        } else {
            res.sendStatus(404);
        }
    });

    app.delete('/api/admin/glams/:id/annotations/:date', async function (req, res, next) {
        let glam = await getGlamByName(req.params.id);
        if (glam !== undefined) {
            api.deleteAnnotation(req, res, next, glam);
        } else {
            res.sendStatus(404);
        }
    });

    app.get('/api/:id/category', async function (req, res, next) {
        let glam = await getGlamByName(req.params.id);
        if (isValidGlam(glam)) {
            api.categoryGraph(req, res, next, glam.connection);
        } else {
            res.sendStatus(400);
        }
    });

    app.get('/api/:id/category/dataset', async function (req, res, next) {
        let glam = await getGlamByName(req.params.id);
        if (isValidGlam(glam)) {
            api.categoryGraphDataset(req, res, next, glam.connection);
        } else {
            res.sendStatus(400);
        }
    });

    app.get('/api/:id/category/:category', async function (req, res, next) {
        let glam = await getGlamByName(req.params.id);
        if (isValidGlam(glam)) {
            api.categoryFiles(req, res, next, glam.connection);
        } else {
            res.sendStatus(400);
        }
    });

    app.get('/api/:id', async function (req, res, next) {
        let glam = await getGlamByName(req.params.id);
        if (isValidGlam(glam)) {
            api.getGlam(req, res, next, glam);
        } else {
            res.sendStatus(400);
        }
    });

    app.get('/api/:id/views', async function (req, res, next) {
        let glam = await getGlamByName(req.params.id);
        if (isValidGlam(glam)) {
            api.views(req, res, next, glam.connection);
        } else {
            res.sendStatus(400);
        }
    });

    app.get('/api/:id/views/dataset/:timespan', async function (req, res, next) {
        let glam = await getGlamByName(req.params.id);
        if (isValidGlam(glam)) {
            api.viewsDataset(req, res, next, glam.connection);
        } else {
            res.sendStatus(400);
        }
    });

    app.get('/api/:id/views/sidebar', async function (req, res, next) {
        let glam = await getGlamByName(req.params.id);
        if (isValidGlam(glam)) {
            api.viewsSidebar(req, res, next, glam.connection);
        } else {
            res.sendStatus(400);
        }
    });

    app.get('/api/:id/views/file/:file', async function (req, res, next) {
        let glam = await getGlamByName(req.params.id);
        if (isValidGlam(glam) || req.params.file !== undefined) {
            api.viewsByFile(req, res, next, glam.connection);
        } else {
            res.sendStatus(400);
        }
    });

    app.get('/api/:id/views/stats', async function (req, res, next) {
        let glam = await getGlamByName(req.params.id);
        if (isValidGlam(glam) || req.params.file !== undefined) {
            api.viewsStats(req, res, next, glam.connection);
        } else {
            res.sendStatus(400);
        }
    });

    app.get('/api/:id/usage', async function (req, res, next) {
        let glam = await getGlamByName(req.params.id);
        if (isValidGlam(glam)) {
            api.usage(req, res, next, glam.connection);
        } else {
            res.sendStatus(400);
        }
    });

    app.get('/api/:id/usage/dataset', async function (req, res, next) {
        let glam = await getGlamByName(req.params.id);
        if (isValidGlam(glam)) {
            api.usageDataset(req, res, next, glam.connection);
        } else {
            res.sendStatus(400);
        }
    });

    app.get('/api/:id/usage/file/:file', async function (req, res, next) {
        let glam = await getGlamByName(req.params.id);
        if (isValidGlam(glam)) {
            api.usageFile(req, res, next, glam.connection);
        } else {
            res.sendStatus(400);
        }
    });

    app.get('/api/:id/usage/stats', async function (req, res, next) {
        let glam = await getGlamByName(req.params.id);
        if (isValidGlam(glam)) {
            api.usageStats(req, res, next, glam.connection);
        } else {
            res.sendStatus(400);
        }
    });

    app.get('/api/:id/usage/top', async function (req, res, next) {
        let glam = await getGlamByName(req.params.id);
        if (isValidGlam(glam)) {
            api.usageTop(req, res, next, glam.connection);
        } else {
            res.sendStatus(400);
        }
    });

    app.get('/api/:id/file/upload-date', async function (req, res, next) {
        let glam = await getGlamByName(req.params.id);
        if (isValidGlam(glam)) {
            api.uploadDate(req, res, next, glam.connection);
        } else {
            res.sendStatus(400);
        }
    });

    app.get('/api/:id/file/upload-date/dataset/:timespan', async function (req, res, next) {
        let glam = await getGlamByName(req.params.id);
        if (isValidGlam(glam)) {
            api.uploadDateDataset(req, res, next, glam.connection);
        } else {
            res.sendStatus(400);
        }
    });

    app.get('/api/:id/file/upload-date-all', async function (req, res, next) {
        let glam = await getGlamByName(req.params.id);
        if (isValidGlam(glam)) {
            api.uploadDateAll(req, res, next, glam.connection);
        } else {
            res.sendStatus(400);
        }
    });

    app.get('/api/:id/file/details/:file', async function (req, res, next) {
        let glam = await getGlamByName(req.params.id);
        if (isValidGlam(glam)) {
            api.fileDetails(req, res, next, glam.connection);
        } else {
            res.sendStatus(400);
        }
    });

    app.get('/api/:id/search/:query', async function (req, res, next) {
        let glam = await getGlamByName(req.params.id);
        if (isValidGlam(glam)) {
            api.search(req, res, next, glam.connection);
        } else {
            res.sendStatus(400);
        }
    });

    app.get('/api/:id/recommender', async function (req, res, next) {
        let glam = await getGlamByName(req.params.id);
        if (isValidGlam(glam)) {
            api.recommender(req, res, next, glam.connection);
        } else {
            res.sendStatus(400);
        }
    });

    app.get('/api/:id/recommender/:file', async function (req, res, next) {
        let glam = await getGlamByName(req.params.id);
        if (isValidGlam(glam)) {
            api.recommenderByFile(req, res, next, glam.connection);
        } else {
            res.sendStatus(400);
        }
    });

    app.delete('/api/:id/recommender/:file', async function (req, res, next) {
        let glam = await getGlamByName(req.params.id);
        if (isValidGlam(glam)) {
            api.hideRecommenderByFile(req, res, next, glam.connection);
        } else {
            res.sendStatus(400);
        }
    });

    app.get('/api/wikidata/:ids', async function (req, res, next) {
        let url = "https://www.wikidata.org/w/api.php?action=wbgetentities&props=labels|sitelinks/urls&languages=en|fr|de|it&sitefilter=enwiki|frwiki|dewiki|itwiki&format=json&ids=" + req.params.ids;
        request(url, function (error, response, body) {
            if (error) {
                if (response && response.statusCode) {
                    res.error(error);
                    res.sendStatus(response.statusCode);
                }
            } else {
                res.json(JSON.parse(response.body));
            }
        });
    });

    // NOT FOUND
    app.get('*', async function (req, res) {
        res.sendStatus(404);
    });

}
