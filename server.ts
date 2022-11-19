import express from 'express';
import { createServer } from 'http';
import { PubSub } from 'graphql-subscriptions';
import gql from 'graphql-tag';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { expressMiddleware } from "@apollo/server/express4"
import cors from 'cors';
import bodyParser from 'body-parser';

// Asnychronous Anonymous Function
// Inside of server.ts -> await keyword

( async function () {
    // Server code in here!
    const pubsub = new PubSub(); // Publish and Subscribe, Publish -> everyone gets to hear it
    const app = express();
    const httpServer = createServer(app);

    // GraphQL Typedefs and resolvers
    const typeDefs = gql`
        type NewsEvent {
            title: String
            description: String
        }

        type Query {
            placeholder: Boolean
        }
        
        type Mutation {
            createNewsEvent(title: String, description: String) : NewsEvent
        }

        type Subscription {
            newsFeed: NewsEvent
        }
    `

    interface createNewsEventInput {
        title: string
        description: string
    }

    const resolvers = {
        Query: {
            placeholder: () => { return true }
        },
        Mutation: {
            createNewsEvent: (_parent : any, args : createNewsEventInput ) => {
                console.log(args);
                pubsub.publish('EVENT_CREATED', { newsFeed: args });

                // Save news events to a database: you can do that here!

                // Create something : EVENT_CREATED
                // Subscribe to something: EVENT_CREATED
                return args;
            }
        },
        Subscription: {
            newsFeed: {
                subscribe: () => pubsub.asyncIterator(['EVENT_CREATED'])
            }
        }
    }

    const schema = makeExecutableSchema({typeDefs, resolvers});

    // ws Server
    const wsServer = new WebSocketServer({
        server: httpServer,
        path: "/graphql" // localhost:3000/graphql
    });

    const serverCleanup = useServer({ schema }, wsServer); // dispose

    // apollo server
    const server = new ApolloServer({
        schema,
        plugins: [
            ApolloServerPluginDrainHttpServer({ httpServer }),
            {
                async serverWillStart() {
                    return {
                        async drainServer() {
                            await serverCleanup.dispose();
                        }
                    }
                }
            }
        ]
    });

    // start our server
    await server.start();

    // apply middlewares (cors, expressmiddlewares)
    app.use('/graphql', cors<cors.CorsRequest>(), bodyParser.json(), expressMiddleware(server));

    // http server start
    httpServer.listen(4000, () => {
        console.log("Server running on http://localhost:" + "4000" + "/graphql");
    });

})();