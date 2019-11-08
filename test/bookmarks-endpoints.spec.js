/* eslint-disable quotes */
/* eslint-disable no-mixed-spaces-and-tabs */
const { makesBookmarksArray, makeMaliciousBookmark } = require('./bookmarks.fixtures');
const knex = require('knex');
const app = require('../src/app');
const { isWebUri } = require('valid-url');

//only is added so that we're only running this files while working on it
describe('Bookmarks Endpoints', function() {
    let db;

  before('make knex instance', () => {
    db = knex({
      client: 'pg',
      connection: process.env.TEST_DB_URL,
    });
    //db is the knexInstance
    app.set('db', db);
  });
  //Mocha hooks - we can pass description as the first argument for labeling purposes
  after('disconnect from db', () => db.destroy());

  before('clean the table', () => db('bookmarks').truncate());

  afterEach('cleanup', () => db('bookmarks').truncate());

    //Describe for all Unauthorized request
    describe(`Unauthorized requests`, () => {
        it(`responds with 401 Unauthorized for GET /api/bookmarks`, () => {
            return supertest(app)
            .get('/api/bookmarks')
            .expect(401, { error: 'Unauthorized request'})
        })
        it(`responds with 401 Unauthorized for POST /api/bookmarks`, () => {
            return supertest(app)
            .get('/api/bookmarks')
            .send({title: 'testing ony', url:'http://www.yahoo.com', rating: 2})
            .expect(401, { error: 'Unauthorized request'})
        })
        it(`responds with 401 Unauthorized for GET /api/bookmarks/:bookmarkId`, () => {
            const testBookmark = makesBookmarksArray([1]);
            return supertest(app)
            .get(`/api/bookmarks/${testBookmark.id}`)
            .expect(401, { error: 'Unauthorized request'})
        })
        it(`responds with 401 Unauthorized for DELETE /api/bookmarks/:bookmarkId`, () => {
            const testBookmark = makesBookmarksArray([1]);
            return supertest(app)
            .delete(`/api/bookmarks/${testBookmark.id}`)
            .expect(401, { error: 'Unauthorized request'})
        })
        it(`responds with 401 Unauthorized for PATCH /api/bookmarks/:bookmarkId`, () => {
          const testBookmark = makesBookmarksArray([1]);
          return supertest(app)
          .patch(`/api/bookmarks/${testBookmark.id}`)
          .send({title: 'updated-title'})
          .expect(401, { error: 'Unauthorized request'})
      })

        
    })
    
    //Describe for GET /bookmarks
    describe(`GET /api/bookmarks`, () => {
        context(`Given no bookmarks`, () => {
            it(`responds with 200 and an empty list`, () => {
              return supertest(app)
                .get('/api/bookmarks')
                .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
                .expect(200, []);
            });
        });

        context('Given there are bookmarks in the database', () => {
            const testBookmarks = makesBookmarksArray();
            
            beforeEach('insert bookmarks', () => {
                return db
                .into('bookmarks')
                .insert(testBookmarks);
            });

            it('GET /api/bookmarks responds with 200 and all of the bookmarks', () => {
                return supertest(app)
                .get('/api/bookmarks')
                .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
                .expect(200, testBookmarks);
            });
        });
        context(`Given an XSS attack bookmark`, () => {
          const { maliciousBookmark, expectedBookmark } = makeMaliciousBookmark()
    
          beforeEach('insert malicious bookmark', () => {
            return db
              .into('bookmarks')
              .insert([ maliciousBookmark ]);
          });
    
          it('removes XSS attack content', () => {
            return supertest(app)
              .get(`/api/bookmarks`)
              .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
              .expect(200)
              .expect(res => {
                expect(res.body[0].title).to.eql(expectedBookmark.title);
                expect(res.body[0].description).to.eql(expectedBookmark.description);
              });
          });
        });
    });//end of GET /bookmarks

    //Describe for Get /bookmarks/:bookmarkId
    describe(`GET /api/bookmarks/:bookmarkId`, () => {
        context(`Given no bookmarks`, () => {
          it(`responds with 404`, () => {
            const bookmarkId = 123;
            return supertest(app)
              .get(`/api/bookmarks/${bookmarkId}`)
              .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
              .expect(404, { error:  {message: `Bookmark doesn't exist`}});
          });
        });

        context('Given there are bookmarks in the database', () => {
            const testBookmarks = makesBookmarksArray();
      
            beforeEach('insert bookmarks', () => {
              return db
                .into('bookmarks')
                .insert(testBookmarks);
            });
      
            it('responds with 200 and the specified bookmark', () => {
              const bookmarkId = 2;
              const expectedBookmark= testBookmarks[bookmarkId - 1];
              return supertest(app)
                .get(`/api/bookmarks/${bookmarkId}`)
                .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
                .expect(200, expectedBookmark);
            });
        });

        context(`Given an XSS attack bookmark`, () => {
          const { maliciousBookmark, expectedBookmark } = makeMaliciousBookmark();
    
          beforeEach('insert malicious bookmark', () => {
            return db
              .into('bookmarks')
              .insert([ maliciousBookmark ]);
          });
    
          it('removes XSS attack content', () => {
            return supertest(app)
              .get(`/api/bookmarks/${maliciousBookmark.id}`)
              .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
              .expect(200)
              .expect(res => {
                expect(res.body.title).to.eql(expectedBookmark.title);
                expect(res.body.url).to.eql(expectedBookmark.url);
                expect(res.body.description).to.eql(expectedBookmark.description);
              });
          });
        });
    });//end of GET /bookmarks/:bookmarkId

    //Describe for Post
    describe(`POST /api/bookmarks`, () => {
        it(`creates a new bookmark, responding with 201 and the new bookmark`, () => {
            // this.retries(3);
            const newBookmark= {
              id: 1,
              title: 'Test for new Bookmark',
              url: 'https://www.google.com/',
              description: 'For testing only',
              rating: 4,
            };
            return supertest(app)
              .post(`/api/bookmarks`)
              .send(newBookmark)
              .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
              .expect(201)
              .expect(res => {
                expect(res.body.title).to.eql(newBookmark.title);
                expect(res.body.url).to.eql(newBookmark.url);
                expect(res.body.description).to.eql(newBookmark.description);
                expect(res.body.rating).to.eql(newBookmark.rating);
                expect(res.body).to.have.property('id');
                expect(res.headers.location).to.eql(`/api/bookmarks/${res.body.id}`);
              })
              .then(postRes =>
                 supertest(app)
                   .get(`/api/bookmarks/${postRes.body.id}`)
                   .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
                   .expect(postRes.body)
              );
          });

        //refactor equivalent for 400
        const requiredFields = ['title', 'url', 'rating'];

        requiredFields.forEach(field => {
          const newBookmark = {
            title: 'Test new bookmark',
            url: 'https://www.google.com/',
            rating: 5
          };

       it(`responds with 400 and an error message when the '${field}' is missing`, () => {
          delete newBookmark[field];

          return supertest(app)
            .post('/api/bookmarks')
            .send(newBookmark)
            .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
            .expect(400, {
              error: { message: `'${field}' is required` }
            });
        });
      });
      it('removes XSS attack content from response', () => {
        const { maliciousBookmark, expectedBookmark } = makeMaliciousBookmark();
        return supertest(app)
          .post(`/api/bookmarks`)
          .send(maliciousBookmark)
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(201)
          .expect(res => {
            expect(res.body.title).to.eql(expectedBookmark.title);
            expect(res.body.url).to.eql(expectedBookmark.url);
            expect(res.body.description).to.eql(expectedBookmark.description);
          });
      });
    }); //end of POST

    //Describe for DELETE
    describe(`DELETE /api/bookmarks/:bookmarkId`, () => {
      context(`Given no bookmarks`, () => {
        it(`responds with 400`, () => {
          const bookmarkId = 123456;
          return supertest(app)
            .delete(`/api/bookmarks/${bookmarkId}`)
            .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
            .expect(404, { error: { message: `Bookmark doesn't exist` } })
        });
      });
  
      context('Given there are bookmarks in the database', () => {
        const testBookmarks = makesBookmarksArray()
  
        beforeEach('insert bookmarks', () => {
          return db
            .into('bookmarks')
            .insert(testBookmarks);
        });
  
        it('responds with 204 and removes the bookmark', () => {
          const idToRemove = 2;
          const expectedBookmarks = testBookmarks.filter(bookmark => bookmark.id !== idToRemove)
          return supertest(app)
            .delete(`/api/bookmarks/${idToRemove}`)
            .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
            .expect(204)
            .then(res =>
              supertest(app)
                .get(`/api/bookmarks`)
                .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
                .expect(expectedBookmarks)
            );
        });
      });
    }); //end of DELETE

    //PATCH
    describe(`PATCH /api/bookmarks/:bookmarkId`, () => {
      context(`Given no bookmarks`, () => {
        it(`responds with 404`, () => {
          const bookmarkId = 123456;
          return supertest(app)
            .delete(`/api/bookmarks/${bookmarkId}`)
            .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
            .expect(404, { error: { message: `Bookmark doesn't exist` } })
        })
      })
  
      context('Given there are bookmarks in the database', () => {
        const testBookmarks = makesBookmarksArray()
  
        beforeEach('insert bookmarks', () => {
          return db
            .into('bookmarks')
            .insert(testBookmarks)
        })
  
        it('responds with 204 and updates the bookmark', () => {
          const idToUpdate = 2
          const updateBookmark = {
            title: 'updated bookmark title',
            url: 'https://www.google.com/',
            description: 'updated bookmark description',
            rating: 4,
          }
          const expectedBookmark = {
            ...testBookmarks[idToUpdate - 1],
            ...updateBookmark
          }
          return supertest(app)
            .patch(`/api/bookmarks/${idToUpdate}`)
            .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
            .send(updateBookmark)
            .expect(204)
            .then(res =>
              supertest(app)
                .get(`/api/bookmarks/${idToUpdate}`)
                .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
                .expect(expectedBookmark)
            )
        })
  
        it(`responds with 400 when no required fields supplied`, () => {
          const idToUpdate = 2
          return supertest(app)
            .patch(`/api/bookmarks/${idToUpdate}`)
            .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
            .send({ irrelevantField: 'foo' })
            .expect(400, {
              error: {
                message: `Request body must content either 'title', 'url', 'description' or 'rating'`
              }
            })
        })
  
        it(`responds with 204 when updating only a subset of fields`, () => {
          const idToUpdate = 2
          const updateBookmark = {
            title: 'updated bookmark title',

          }
          const expectedBookmark = {
            ...testBookmarks[idToUpdate - 1],
            ...updateBookmark
          }
  
          return supertest(app)
            .patch(`/api/bookmarks/${idToUpdate}`)
            .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
            .send({
              ...updateBookmark,
              fieldToIgnore: 'should not be in GET response'
            })
            
            .expect(204)
            .then(res =>
              supertest(app)
                .get(`/api/bookmarks/${idToUpdate}`)
                .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
                .expect(expectedBookmark)
            )
        })
      })
    });//end of PATCH
});