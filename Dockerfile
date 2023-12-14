FROM node:19.7.0-slim

# Create app directory
WORKDIR /app

# Install app dependencies
COPY . /app
RUN yarn install

# Expose port
EXPOSE 80

# Start app
CMD [ "yarn", "start" ]
