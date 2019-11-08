const path = require('path');
const express = require('express');
const xss = require('xss');
const { isWebUri } = require('valid-url');
const logger = require('../logger');

const bookmarksRouter = express.Router();
const BookmarkService = require('./bookmarks-service');
const jsonParser = express.json();

const serializeBookmark = bookmark => ({
  id: bookmark.id,
  title: xss(bookmark.title),
  url: bookmark.url,
  description: xss(bookmark.description),
  rating: Number(bookmark.rating),
})

/* Bookmark routes */
bookmarksRouter
  .route('/')
  .get((req, res, next) => {
    const knexInstance = req.app.get('db');
    BookmarkService.getAllBookmarks(knexInstance)
      .then(bookmarks => {
        if(!bookmarks){
          return res.status(400).json({
            error: { message: `Bookmark doesn't exist` }
          });
        }
        res.json(bookmarks.map(serializeBookmark));
      })
      .catch(next);
  })
  .post(jsonParser, (req, res, next) => {
    //refactoring for title, url and rating if they are null
    for(const field of ['title', 'url', 'rating']) {
      if(!req.body[field]) {
        logger.error(`${field} is required`)
          return res.status(400).send({
            error: {message: `'${field}' is required`}
          })
      }
    }

    const {title, url, description, rating} = req.body;
    const ratingNum = Number(rating);

    if(!Number.isInteger(ratingNum) || ratingNum < 0 || ratingNum > 5) {
      logger.error(`Invalid rating '${rating}' supplied`);
        return res.status(400).send({
          error: { message: `'rating' must be a number between 0 and 5`}
        });
    }

    if(!isWebUri(url)) {
      logger.error(`Invalid url '${url}' supplied`);
        return res.status(400).send({
          error: {message: `'url' must be a valid URL`}
        });
    }
    
    const newBookmark = {title, url,description, rating }

    knexInstance = req.app.get('db');
    BookmarkService.insertBookmark(knexInstance, newBookmark)
      .then(bookmark => {
        logger.info(`Bookmark with id ${bookmark.id} created`);
        res
        .status(201)
        .location(path.posix.join(req.originalUrl) + `/${bookmark.id}`)
        .json(serializeBookmark(bookmark));
      })
      .catch(next)
  })  

bookmarksRouter
  .route('/:bookmarkId')
  .all((req, res, next) => {
    const { bookmarkId } = req.params;

    const knexInstance = req.app.get('db');
    BookmarkService.getById(knexInstance, bookmarkId)
      .then(bookmark => {
          //make sure we found a bookmark
          if(!bookmark) {
            logger.error(`Bookmark with id ${bookmarkId} not found.`);
              return res.status(404).json({
                error: { message: `Bookmark doesn't exist` }
              });
          }
          res.bookmark = bookmark;
          next();
      })
      .catch(next);
    })
    .get((req, res, next) => {
      res.json(serializeBookmark(res.bookmark));
    })
    .delete((req, res, next) => {
      const { bookmarkId } = req.params;
     
      const knexInstance = req.app.get('db');
      BookmarkService.deleteBookmark(knexInstance, req.params.bookmarkId)
        .then(numRowsAffected => {
            logger.info(`Bookmark with id ${bookmarkId} deleted.`);
            res.status(204).end();
        })
        .catch(next)
    })
    .patch(jsonParser, (req, res, next) => {
        const { title, url, description, rating } = req.body;
        const bookmarkToUpdate = { title, url, description, rating };
      
        const numberOfValues = Object.values(bookmarkToUpdate).filter(Boolean).length;
          if (numberOfValues === 0)
            return res.status(400).json({
              error: {
                message: `Request body must content either 'title', 'url', 'description' or 'rating'`
            }
          });
      
        const knexInstance = req.app.get('db');
        BookmarkService.updateBookmark(
          knexInstance,
          req.params.bookmarkId,
          bookmarkToUpdate
        )
          .then(numRowsAffected => {
            res.status(204).end();
          })
          .catch(next);
});

module.exports = bookmarksRouter;