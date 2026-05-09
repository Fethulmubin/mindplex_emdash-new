import { definePlugin } from "emdash";
import { CreatePostSchema } from "./schemas";
import {
  createPostHandler,
  getPostHandler,
  getPostsHandler,
  listPostCommentsHandler,
} from "./routes";

export default definePlugin({
  routes: {
    posts: {
      public: true,
      handler: getPostsHandler,
    },
    "posts/:identifier": {
      public: true,
      handler: getPostHandler,
    },
    "posts/create-post": {
      public: true,
      input: CreatePostSchema,
      handler: createPostHandler,
    },
    "posts/:identifier/comments": {
      public: true,
      handler: listPostCommentsHandler,
    },
  },
});
